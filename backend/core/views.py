"""
File Introduction:
Module: core.views
Role: HTTP entry points for authentication, workspace administration, and membership management.

Responsibilities:
- Exposes registration, cookie-based JWT login/refresh/logout, and profile endpoints.
- Manages organizations, departments, teams, custom roles, and workspace invitations.
- Handles member role assignment and access revocation/reactivation.
"""

from django.conf import settings
from django.core.mail import send_mail
from django.db import connection
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import CustomRole, Department, Organization, SystemRoleTier, Team, User, WorkspaceInvitation
from .permissions import HasRolePermission, IsWorkspaceMember
from .serializers import (
    AcceptInvitationSerializer,
    AvatarUploadSerializer,
    CustomRoleSerializer,
    CustomTokenObtainPairSerializer,
    DepartmentSerializer,
    MemberRoleUpdateSerializer,
    OrganizationSerializer,
    OrgMemberSerializer,
    RegisterSerializer,
    TeamSerializer,
    UserSerializer,
    VerifyInvitationSerializer,
    WorkspaceInvitationSerializer,
)

REFRESH_COOKIE_PATH = "/api/v1/auth/refresh/"


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(request):
    db_status = "ok"
    db_error = None

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception as exc:
        db_status = "error"
        db_error = str(exc)

    payload = {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": {
            "status": db_status,
            "vendor": connection.vendor,
            "name": connection.settings_dict.get("NAME"),
            "error": db_error,
        },
    }

    return Response(payload, status=200 if db_status == "ok" else 503)


def _set_auth_cookies(response: Response, access: str | None, refresh: str | None = None) -> None:
    if access is not None:
        response.set_cookie(
            settings.JWT_AUTH_COOKIE,
            access,
            httponly=True,
            secure=settings.JWT_COOKIE_SECURE,
            samesite=settings.JWT_COOKIE_SAMESITE,
            path="/",
        )
    if refresh is not None:
        response.set_cookie(
            settings.JWT_AUTH_REFRESH_COOKIE,
            refresh,
            httponly=True,
            secure=settings.JWT_COOKIE_SECURE,
            samesite=settings.JWT_COOKIE_SAMESITE,
            path=REFRESH_COOKIE_PATH,
        )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(settings.JWT_AUTH_COOKIE, path="/")
    response.delete_cookie(settings.JWT_AUTH_REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class CookieTokenObtainPairView(TokenObtainPairView):
    """Logs in and sets the access/refresh tokens as HttpOnly cookies."""

    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code != status.HTTP_200_OK:
            return response

        access = response.data.pop("access", None)
        refresh = response.data.pop("refresh", None)
        _set_auth_cookies(response, access, refresh)
        response.data["detail"] = "Authenticated"
        return response


class CookieTokenRefreshView(TokenRefreshView):
    """Rotates tokens using the refresh cookie instead of a request body field."""

    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(settings.JWT_AUTH_REFRESH_COOKIE)
        if refresh_token is None:
            return Response({"detail": "Refresh token missing."}, status=status.HTTP_401_UNAUTHORIZED)

        request.data["refresh"] = refresh_token
        response = super().post(request, *args, **kwargs)
        if response.status_code != status.HTTP_200_OK:
            return response

        access = response.data.pop("access", None)
        refresh = response.data.pop("refresh", None)
        _set_auth_cookies(response, access, refresh)
        response.data["detail"] = "Refreshed"
        return response


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        if request.data.get("all_devices"):
            for outstanding in OutstandingToken.objects.filter(user=request.user):
                BlacklistedToken.objects.get_or_create(token=outstanding)
        else:
            refresh_token = request.COOKIES.get(settings.JWT_AUTH_REFRESH_COOKIE)
            if refresh_token:
                try:
                    RefreshToken(refresh_token).blacklist()
                except TokenError:
                    pass

        response = Response({"detail": "Logged out"}, status=status.HTTP_200_OK)
        _clear_auth_cookies(response)
        return response


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user


class MeAvatarUploadView(generics.GenericAPIView):
    """POST /auth/me/avatar/ — multipart image upload, kept off MeView's own PATCH."""

    serializer_class = AvatarUploadSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if user.avatar:
            user.avatar.delete(save=False)
        user.avatar = serializer.validated_data["avatar"]
        user.save(update_fields=["avatar"])

        return Response(UserSerializer(user, context={"request": request}).data)


class OrganizationViewSet(viewsets.ModelViewSet):
    """Provisioned at registration; only Owner/Global Admin/HR Manager may edit it afterward."""

    serializer_class = OrganizationSerializer
    permission_classes = [IsWorkspaceMember]
    http_method_names = ["get", "patch", "delete", "post", "head", "options"]

    def get_queryset(self):
        return Organization.objects.filter(id=self.request.user.organization_id)

    def perform_update(self, serializer):
        membership = getattr(self.request.user, "membership", None)
        can_manage = bool(
            membership and (membership.is_global_admin or membership.role_tier == SystemRoleTier.HR_MANAGER)
        )
        if not can_manage:
            raise PermissionDenied("Only a Global Administrator or HR Manager can update workspace settings.")
        serializer.save()

    @action(detail=True, methods=["post"], url_path="transfer-ownership")
    def transfer_ownership(self, request, pk=None):
        """Owner-only: hands ownership to another member, demoting the
        current owner to Global Admin and promoting the target."""
        organization = self.get_object()
        actor_membership = getattr(request.user, "membership", None)
        if not (actor_membership and organization.owner_id == request.user.id):
            raise PermissionDenied("Only the current workspace owner can transfer ownership.")

        new_owner_id = request.data.get("new_owner_id")
        new_owner = User.objects.filter(id=new_owner_id, organization_id=organization.id).first()
        if new_owner is None:
            return Response({"detail": "That user isn't a member of this workspace."}, status=status.HTTP_400_BAD_REQUEST)
        new_owner_membership = getattr(new_owner, "membership", None)
        if new_owner_membership is None:
            return Response({"detail": "That user has no workspace membership."}, status=status.HTTP_400_BAD_REQUEST)

        organization.owner = new_owner
        organization.save(update_fields=["owner"])

        actor_membership.role_tier = SystemRoleTier.GLOBAL_ADMIN
        actor_membership.save(update_fields=["role_tier", "updated_at"])
        new_owner_membership.role_tier = SystemRoleTier.OWNER
        new_owner_membership.is_global_admin = True
        new_owner_membership.save(update_fields=["role_tier", "is_global_admin", "updated_at"])

        return Response(OrganizationSerializer(organization, context={"request": request}).data)

    def perform_destroy(self, instance):
        membership = getattr(self.request.user, "membership", None)
        if not (membership and instance.owner_id == self.request.user.id):
            raise PermissionDenied("Only the workspace owner can delete the workspace.")
        confirmed_name = self.request.data.get("confirm_name", "")
        if confirmed_name != instance.name:
            raise PermissionDenied("Workspace name confirmation did not match.")
        instance.delete()


class DepartmentViewSet(viewsets.ModelViewSet):
    serializer_class = DepartmentSerializer
    permission_classes = [IsWorkspaceMember]

    def get_queryset(self):
        return Department.objects.filter(organization_id=self.request.user.organization_id)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)


class TeamViewSet(viewsets.ModelViewSet):
    serializer_class = TeamSerializer
    permission_classes = [IsWorkspaceMember]
    filterset_fields = ["department"]

    def get_queryset(self):
        return Team.objects.filter(organization_id=self.request.user.organization_id)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)


def _can_manage_member(actor: User, *, capability: str) -> bool:
    membership = getattr(actor, "membership", None)
    if membership is None:
        return False
    return membership.is_global_admin or membership.has_permission(capability)


class OrgUserViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only "Manage Users" listing, plus role assignment and revoke/reactivate actions."""

    serializer_class = OrgMemberSerializer
    permission_classes = [IsWorkspaceMember]

    def get_queryset(self):
        return (
            User.objects.filter(organization_id=self.request.user.organization_id)
            .select_related("membership", "membership__custom_role")
            .prefetch_related("team_memberships__team__department")
        )

    @action(detail=True, methods=["patch"], url_path="role")
    def role(self, request, pk=None):
        if not _can_manage_member(request.user, capability="can_assign_roles"):
            return Response({"detail": "You don't have permission to assign roles."}, status=status.HTTP_403_FORBIDDEN)

        target = self.get_object()
        membership = getattr(target, "membership", None)
        if membership is None:
            return Response({"detail": "This user has no workspace membership to update."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = MemberRoleUpdateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        new_tier = serializer.validated_data.get("role_tier")
        actor_membership = request.user.membership
        if new_tier in (SystemRoleTier.OWNER, SystemRoleTier.GLOBAL_ADMIN) and not actor_membership.is_global_admin:
            return Response(
                {"detail": "Only a Global Administrator can grant that role."}, status=status.HTTP_403_FORBIDDEN
            )

        update_fields = []
        if "role_tier" in serializer.validated_data:
            membership.role_tier = serializer.validated_data["role_tier"]
            update_fields.append("role_tier")
        if "custom_role" in serializer.validated_data:
            membership.custom_role = serializer.validated_data["custom_role"]
            update_fields.append("custom_role")
        if update_fields:
            membership.save(update_fields=[*update_fields, "updated_at"])

        return Response(OrgMemberSerializer(target).data)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        if not _can_manage_member(request.user, capability="can_revoke_access"):
            return Response({"detail": "You don't have permission to revoke access."}, status=status.HTTP_403_FORBIDDEN)

        target = self.get_object()
        if target.id == request.user.id:
            return Response({"detail": "You can't revoke your own access."}, status=status.HTTP_400_BAD_REQUEST)

        membership = getattr(target, "membership", None)
        if membership is None:
            return Response({"detail": "This user has no workspace membership to revoke."}, status=status.HTTP_400_BAD_REQUEST)
        if membership.is_global_admin and not request.user.membership.is_global_admin:
            return Response(
                {"detail": "Only a Global Administrator can revoke another administrator."},
                status=status.HTTP_403_FORBIDDEN,
            )

        membership.is_authorized = False
        membership.revoked_at = timezone.now()
        membership.revoked_by = request.user
        membership.save(update_fields=["is_authorized", "revoked_at", "revoked_by", "updated_at"])

        # Blacklisting alone doesn't invalidate an already-issued, unexpired
        # access token — IsWorkspaceMember's is_authorized check is what
        # makes revocation take effect immediately.
        for outstanding in OutstandingToken.objects.filter(user=target):
            BlacklistedToken.objects.get_or_create(token=outstanding)

        return Response(OrgMemberSerializer(target).data)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        if not _can_manage_member(request.user, capability="can_revoke_access"):
            return Response({"detail": "You don't have permission to reactivate access."}, status=status.HTTP_403_FORBIDDEN)

        target = self.get_object()
        membership = getattr(target, "membership", None)
        if membership is None:
            return Response({"detail": "This user has no workspace membership to reactivate."}, status=status.HTTP_400_BAD_REQUEST)

        membership.is_authorized = True
        membership.revoked_at = None
        membership.revoked_by = None
        membership.save(update_fields=["is_authorized", "revoked_at", "revoked_by", "updated_at"])
        return Response(OrgMemberSerializer(target).data)


class CustomRoleViewSet(viewsets.ModelViewSet):
    """Admin-defined job roles with granular capability flags. Creating a
    role is Global Admin/Owner-only; assigning one only needs can_assign_roles."""

    serializer_class = CustomRoleSerializer
    permission_classes = [IsWorkspaceMember, HasRolePermission]
    required_roles = ("is_global_admin",)

    def get_queryset(self):
        return CustomRole.objects.filter(organization_id=self.request.user.organization_id).select_related("department")

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [IsWorkspaceMember()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization, created_by=self.request.user)


def _send_invitation_email(invitation: WorkspaceInvitation) -> None:
    accept_url = f"{settings.FRONTEND_URL}/invite/accept?token={invitation.token}"
    send_mail(
        subject=f"You're invited to join {invitation.organization.name} on APC",
        message=(
            f"You've been invited to join the \"{invitation.organization.name}\" workspace on APC.\n\n"
            f"Accept your invitation: {accept_url}\n\n"
            f"This link expires on {invitation.expires_at:%B %d, %Y}."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitation.email],
        fail_silently=True,
    )


class WorkspaceInvitationViewSet(viewsets.ModelViewSet):
    """Admin/creator-only invitation management, plus public verify/accept sub-routes."""

    serializer_class = WorkspaceInvitationSerializer
    permission_classes = [IsWorkspaceMember, HasRolePermission]
    required_roles = ("is_creator", "is_global_admin")
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return WorkspaceInvitation.objects.filter(organization_id=self.request.user.organization_id)

    def perform_create(self, serializer):
        invitation = serializer.save(organization=self.request.user.organization, invited_by=self.request.user)
        _send_invitation_email(invitation)

    def destroy(self, request, *args, **kwargs):
        invitation = self.get_object()
        invitation.status = WorkspaceInvitation.Status.REVOKED
        invitation.save(update_fields=["status"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def verify(self, request):
        token = request.query_params.get("token", "")
        invitation = WorkspaceInvitation.objects.select_related("organization").filter(token=token).first()
        if invitation is None or not invitation.is_redeemable():
            return Response({"detail": "This invitation link is invalid or has expired."}, status=status.HTTP_404_NOT_FOUND)

        data = VerifyInvitationSerializer(
            {
                "email": invitation.email,
                "organization_name": invitation.organization.name,
                "is_creator": invitation.is_creator,
                "is_global_admin": invitation.is_global_admin,
                "is_content_manager": invitation.is_content_manager,
            }
        ).data
        return Response(data)

    @action(detail=False, methods=["post"], permission_classes=[permissions.AllowAny])
    def accept(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        token_serializer = CustomTokenObtainPairSerializer.get_token(user)
        response = Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        _set_auth_cookies(response, str(token_serializer.access_token), str(token_serializer))
        return response
