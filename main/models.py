from django.db import models
from django.core import validators
from django.utils import timezone
from django.core.mail import send_mail
from django.contrib.auth.models import PermissionsMixin, UserManager
from django.contrib.auth.base_user import AbstractBaseUser

CHOICE_GENDER = ((1, 'Male'), (2, 'Female'))


class User(AbstractBaseUser, PermissionsMixin):
    """
    An class implementing a fully featured User model with
    admin-compliant permissions.
    """
    username = models.CharField(
        'username',
        max_length=30,
        unique=True,
        help_text='Required. 30 characters or fewer. Letters, digits and ./-/_ only.',
        validators=[
            validators.RegexValidator(
                r'^[\w.-]+$',
                ('Enter a valid username. This value may contain only '
                  'letters, numbers ' 'and ./-/_ characters.')
            ),
        ],
        error_messages={
            'unique': "A user with that username already exists.",
        },
    )
    first_name = models.CharField('first name', max_length=30) # Removed "blank" attribute
    last_name = models.CharField('last name', max_length=30) # Removed "blank" attribute
    email = models.EmailField('email address', unique=True) # Changed from "blank" to "unique" attribute

    # Added custom fields [BEGIN]

    gender = models.IntegerField(choices=CHOICE_GENDER, default=1)
    birth_date = models.DateField()
    city = models.CharField(max_length=75)
    country = models.CharField(max_length=25)

    # Added custom fields [END]

    is_staff = models.BooleanField(
        'staff status',
        default=False,
        help_text='Designates whether the user can log into this admin site.',
    )
    is_active = models.BooleanField(
        'active',
        default=True,
        help_text=(
            'Designates whether this user should be treated as active. '
            'Unselect this instead of deleting accounts.'
        ),
    )
    date_joined = models.DateTimeField('date joined', default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'first_name', 'last_name', 'gender', 'birth', 'city', 'country'] # Added fields after "email"

    class Meta:
        swappable = 'AUTH_USER_MODEL'
        ordering = ('username',)
        verbose_name = 'user'
        verbose_name_plural = 'users'

    def get_full_name(self):
        """
        Returns the first_name plus the last_name, with a space in between.
        """
        full_name = '%s %s' % (self.first_name, self.last_name)
        return full_name.strip()

    def get_short_name(self):
        "Returns the short name for the user."
        return self.first_name

    def email_user(self, subject, message, from_email=None, **kwargs):
        """
        Sends an email to this User.
        """
        send_mail(subject, message, from_email, [self.email], **kwargs)

