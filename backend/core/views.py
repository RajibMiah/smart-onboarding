from django.conf import settings
from django.core.mail import send_mail
from django.db import connection
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import Department, Organization, Team, User, WorkspaceInvitation
from .permissions import HasRolePermission, IsWorkspaceMember
from .serializers import (
    AcceptInvitationSerializer,
    CustomTokenObtainPairSerializer,
    DepartmentSerializer,
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


class OrganizationViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only: an organization is provisioned at registration, not edited here."""

    serializer_class = OrganizationSerializer
    permission_classes = [IsWorkspaceMember]

    def get_queryset(self):
        return Organization.objects.filter(id=self.request.user.organization_id)


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


class OrgUserViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only "Manage Users" listing: every member of the caller's organization."""

    serializer_class = OrgMemberSerializer
    permission_classes = [IsWorkspaceMember]

    def get_queryset(self):
        return (
            User.objects.filter(organization_id=self.request.user.organization_id)
            .select_related("membership")
            .prefetch_related("team_memberships__team__department")
        )


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
    """Admin/creator-only: send, list, and revoke email invitations to join the workspace.

    `verify` and `accept` are public sub-routes (`/invitations/verify/`,
    `/invitations/accept/`) used by the unauthenticated accept-invite page.
    """

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
