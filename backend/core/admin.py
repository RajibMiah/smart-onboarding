from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import (
    CustomRole,
    Department,
    Organization,
    Team,
    TeamMembership,
    User,
    WorkspaceInvitation,
    WorkspaceMembership,
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ["email"]
    list_display = ["email", "organization", "is_active", "is_staff"]
    search_fields = ["email", "first_name", "last_name"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "avatar_url", "organization")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2")}),
    )


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "tier", "owner", "created_at"]
    search_fields = ["name", "slug"]


@admin.register(WorkspaceInvitation)
class WorkspaceInvitationAdmin(admin.ModelAdmin):
    list_display = ["email", "organization", "status", "invited_by", "created_at", "expires_at"]
    list_filter = ["status"]
    search_fields = ["email", "organization__name"]


@admin.register(WorkspaceMembership)
class WorkspaceMembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "organization", "role_tier", "is_authorized", "is_global_admin", "custom_role"]
    list_filter = ["role_tier", "is_authorized", "is_global_admin"]
    search_fields = ["user__email"]


@admin.register(CustomRole)
class CustomRoleAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "department", "created_by", "created_at"]
    search_fields = ["name", "organization__name"]


admin.site.register(Department)
admin.site.register(Team)
admin.site.register(TeamMembership)
