from django.core.management.commands.makemessages import Command as MakeMessagesCommand
from ..gen_po_angular import main as gen_po_angular
from ..sync_po import sync
from django.conf import settings
from os import path, makedirs
from glob import glob

class Command(MakeMessagesCommand):
    def handle(self, *args, **options):
        if options['domain'] not in ('angularjs', 'sync'):
            super().handle(*args, **options)
            return

        locale = options['locale']
        exclude = options['exclude']

        locale_paths = []
        default_locale_path = None
        if path.isdir(path.join('conf', 'locale')):
            locale_paths = [path.abspath(path.join('conf', 'locale'))]
            default_locale_path = locale_paths[0]
        else:
            locale_paths.extend(settings.LOCALE_PATHS)
            # Allow to run makemessages inside an app dir
            if path.isdir('locale'):
                locale_paths.append(path.abspath('locale'))
            if locale_paths:
                default_locale_path = locale_paths[0]
                if not path.exists(default_locale_path):
                    makedirs(default_locale_path)

        # Build locale list
        locale_dirs = filter(path.isdir, glob('%s/*' % default_locale_path))
        all_locales = map(path.basename, locale_dirs)

        # Account for excluded locales
        if options.get('all', False):
            locales = all_locales
        else:
            locales = locale or all_locales
            locales = set(locales) - set(exclude)

        is_sync = options['domain'] == 'sync'
        for pt in locale_paths:
            for locale in locales:
                p = path.join(pt, locale, 'LC_MESSAGES', 'djangojs.po')
                if not path.exists(p):
                    if is_sync:
                        continue
                    with open(p, 'w'): pass
                if is_sync:
                    sync(path.join(pt, locale, 'LC_MESSAGES', 'django.po'), p)
                else:
                    gen_po_angular('.', p)
