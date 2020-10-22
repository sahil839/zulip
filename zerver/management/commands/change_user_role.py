from argparse import ArgumentParser
from typing import Any

from django.core.management.base import CommandError

from zerver.lib.actions import do_change_is_api_super_user, do_change_user_role
from zerver.lib.management import ZulipBaseCommand
from zerver.models import UserProfile


class Command(ZulipBaseCommand):
    help = """Change role of an existing user in their (own) Realm.

ONLY perform this on customer request from an authorized person.
"""

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument('email', metavar='<email>',
                            help="email of user to change role")
        parser.add_argument('new_role', metavar='<new_role>',
                            choices=['owner', 'admin', 'member', 'guest', 'api_super_user'],
                            help="new role of the user")
        parser.add_argument('--revoke',
                            dest='grant',
                            action="store_false",
                            help='Remove an api_super_user\'s rights.')
        self.add_realm_args(parser, True)

    def handle(self, *args: Any, **options: Any) -> None:
        email = options['email']
        realm = self.get_realm(options)

        user = self.get_user(email, realm)

        user_role_map = {'owner': UserProfile.ROLE_REALM_OWNER,
                         'admin': UserProfile.ROLE_REALM_ADMINISTRATOR,
                         'member': UserProfile.ROLE_MEMBER,
                         'guest': UserProfile.ROLE_GUEST}

        if options['new_role'] != 'api_super_user':
            new_role = user_role_map[options['new_role']]
            if not options['grant']:
                raise CommandError("Cannot use revoke option with role other than api_super_user.")
            if new_role == user.role:
                raise CommandError("User already has this role.")
            do_change_user_role(user, new_role, acting_user=None)
            print("Done!")
        else:
            if user.is_api_super_user and options['grant']:
                raise CommandError("User is already api super user for this realm.")
            elif not user.is_api_super_user and not options['grant']:
                raise CommandError("User is not api super user for this realm.")
            do_change_is_api_super_user(user, options['grant'])
            print("Done!")
