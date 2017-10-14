"""
Django settings for gournet project.

Generated by 'django-admin startproject' using Django 1.9.2.

For more information on this file, see
https://docs.djangoproject.com/en/1.9/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/1.9/ref/settings/
"""

import os #, datetime

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/1.9/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'fbf0+@#!&9&!rb%6s4veb_#f7)r+1=u9ktofp_sc@=oi#%tnal'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = False #True #repl with False

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '.gournet.co'] #['*'] #repl with
SESSION_COOKIE_DOMAIN = '.gournet.co' #disable

# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
    'django.contrib.gis',
#    'django_extensions',
    'rest_framework',
    'rest_framework.authtoken',
#    'generic_relations',
    'drf_multiple_model',
    'decorator_include',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.facebook',
    'allauth.socialaccount.providers.google',
#    'allauth.socialaccount.providers.linkedin_oauth2',
#    'allauth.socialaccount.providers.paypal',
#    'allauth.socialaccount.providers.twitter',
#    'djng',
#    'autoslug',
#    'cities_light',
#    'modeltranslation',
    'phonenumber_field',
    'multiselectfield',
    'bootstrap3',
    'stronghold',
    'captcha',
    'django_settings_export',
    'timezone_field',
    'statici18n',
    'related_admin',
    'main'
]

SITE_ID = 1

MIDDLEWARE_CLASSES = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.auth.middleware.SessionAuthenticationMiddleware',
    'main.middleware.TimezoneLocaleMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'stronghold.middleware.LoginRequiredMiddleware',
]

from django.conf.global_settings import CACHES
CACHES['rates'] = {
    'BACKEND': 'django.core.cache.backends.filebased.FileBasedCache',
    'LOCATION': '/var/tmp/django_cache_rates',
    'TIMEOUT': 43200
}

LOCALE_PATHS = (os.path.join(BASE_DIR, 'locale'),)

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'main.pagination.CursorPagination',
    'DEFAULT_METADATA_CLASS': 'main.metadata.Metadata',
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ),
}

ROOT_URLCONF = 'gournet.urls'
AUTH_USER_MODEL = 'main.User'
LOGIN_URL = '/'
LOGIN_REDIRECT_URL = '/'

ACCOUNT_EMAIL_REQUIRED = True
#ACCOUNT_UNIQUE_EMAIL = True
SOCIALACCOUNT_QUERY_EMAIL = True
ACCOUNT_EMAIL_VERIFICATION = "mandatory" #none #repl with mandatory
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = True
#EMAIL_CONFIRMATION_EXPIRE_DAYS = 3
#ACCOUNT_LOGIN_ON_PASSWORD_RESET = True
ACCOUNT_ADAPTER = "main.adapters.AccountAdapter"
SOCIALACCOUNT_ADAPTER = "main.adapters.SocialAccountAdapter"
SOCIALACCOUNT_AUTO_SIGNUP = False
ACCOUNT_PASSWORD_MIN_LENGTH = 8
ACCOUNT_LOGOUT_ON_GET = True

RECAPTCHA_PUBLIC_KEY = "***REMOVED***"
RECAPTCHA_PRIVATE_KEY = "***REMOVED***"
NOCAPTCHA = True

PHONENUMBER_DEFAULT_REGION = "RS"

# Begin custom

EVENT_PAGE_SIZE = 15
NOTIFICATION_PAGE_SIZE = 5
COMMENT_PAGE_SIZE = 4
SEARCH_PAGE_SIZE = 10

GMAPS_API_KEY = "***REMOVED***"
GMAPS_API_KEY_FRONTEND = "***REMOVED***"

# End custom

SETTINGS_EXPORT = [
    'NOTIFICATION_PAGE_SIZE',
    'GMAPS_API_KEY_FRONTEND'
]

SOCIALACCOUNT_PROVIDERS = {
    'facebook': {
        'SCOPE': ['email', 'public_profile', 'user_birthday', 'user_location', 'user_hometown'],
        'AUTH_PARAMS': {'auth_type': 'https'},
        'VERIFIED_EMAIL': True,
        'FIELDS': ['id', 'email', 'first_name', 'last_name', 'gender', 'birthday', 'location']
    },
    'google': {
        'SCOPE': ['profile', 'email'],
        'AUTH_PARAMS': {'access_type': 'online'}
    }
}

SOCIALACCOUNT_FORMS = {'signup': 'main.allauth_forms.SocialSignupForm'}
ACCOUNT_FORMS = {'signup': 'main.allauth_forms.SignupForm', 'login': 'main.allauth_forms.LoginForm'}

STRONGHOLD_DEFAULTS = True
STRONGHOLD_PUBLIC_URLS = (
    r'/social/',
    r'/api/',
    r'/password/reset/',
    r'/email/confirm/',
    r'/logout/',
    r'/static/',
    r'/admin/'
)

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')]
        ,
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'django.template.context_processors.request',
                'django_settings_export.settings_export',
                'main.context_processor.base'
            ],
        },
    },
]

AUTHENTICATION_BACKENDS = (
    # Needed to login by username in Django admin, regardless of `allauth`
    'django.contrib.auth.backends.ModelBackend',
    # `allauth` specific authentication methods, such as login by e-mail
    'allauth.account.auth_backends.AuthenticationBackend',
)

WSGI_APPLICATION = 'gournet.wsgi.application'


# Database
# https://docs.djangoproject.com/en/1.9/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': 'gournet',
        'USER': 'mikisoft',
        'PASSWORD': 'bed85ae9c2',
        'HOST': 'localhost',
        'PORT': '',
    }
}


# Password validation
# https://docs.djangoproject.com/en/1.9/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/1.9/topics/i18n/

from django.utils.translation import gettext_lazy
LANGUAGES = (('en-us', gettext_lazy('English')),
             ('sr-latn', gettext_lazy('Serbian')))

LANGUAGE_CODE = 'sr-latn'

TIME_ZONE = 'Europe/Belgrade'

USE_I18N = True

USE_L10N = False

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/1.9/howto/static-files/

STATIC_URL = '/static/'

STATIC_ROOT = os.path.join(BASE_DIR, 'static')

MEDIA_URL = '/media/'

MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# SMTP

DEFAULT_FROM_EMAIL = 'no-reply@gournet.co'
SERVER_EMAIL = 'root@gournet.co'