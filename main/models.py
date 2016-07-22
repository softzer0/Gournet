from django.db import models
from django.core import validators
from django.utils import timezone
from django.core.mail import send_mail
from django.contrib.auth.models import PermissionsMixin, UserManager
from django.contrib.auth.base_user import AbstractBaseUser
from django.db.models.signals import post_delete, pre_save
from django.dispatch.dispatcher import receiver
from django.core.exceptions import ValidationError
#from django_thumbs.db.models import ImageWithThumbsField
from phonenumber_field.modelfields import PhoneNumberField
from django.core.validators import MinLengthValidator
import datetime

CHOICE_GENDER = ((1, 'Male'), (2, 'Female'))
SUPPORTED_PLACES = ((0, "Serbia, Vranje"),)

class User(AbstractBaseUser, PermissionsMixin):
    """
    An class implementing a fully featured User model with
    admin-compliant permissions.
    """
    username = models.CharField(
        'username',
        max_length=30,
        unique=True,
        help_text='Maximum 30 characters. Letters, digits and ./-/_ only.',
        validators=[
            validators.RegexValidator(
                r'^[\w.-]+$',
                ('Enter a valid username. This value may contain only '
                  'letters, numbers and ./-/_ characters.')
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

    #avatar = ImageWithThumbsField(upload_to=upload_to, blank=True, sizes=((48,48),(64,64)))
    friends = models.ManyToManyField('self', blank=True, symmetrical=False, through='Relationship')
    favourites = models.ManyToManyField('Business', blank=True, related_name='favoured_by')
    likes_dislikes = models.ManyToManyField('Event', blank=True, through='Like')
    #comments = models.ManyToManyField('Event', blank=True, through='Comment', related_name='commented_by')

    gender = models.IntegerField('gender', choices=CHOICE_GENDER, default=1)
    birthdate = models.DateField('birthdate')
    location = models.IntegerField(choices=SUPPORTED_PLACES)

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
    REQUIRED_FIELDS = ['email', 'first_name', 'last_name', 'gender', 'birthdate', 'country', 'city'] # Added fields after "email"

    class Meta:
        swappable = 'AUTH_USER_MODEL'
        ordering = ('username', 'first_name', 'last_name')
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

class Relationship(models.Model):
    from_person = models.ForeignKey(User, on_delete=models.CASCADE, related_name="from_person")
    to_person = models.ForeignKey(User, on_delete=models.CASCADE, related_name="to_person")
    notification = models.OneToOneField('Notification', null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        unique_together = (('from_person', 'to_person'),)

    """def save(self, *args, **kwargs):
        if self.from_person == self.to_person:
            return
        else:
            super().save(*args, **kwargs)"""

    def __str__(self):
        return '%s with %s' % (self.from_person.get_username(), self.to_person.get_username())

@receiver(pre_save, sender=Relationship, dispatch_uid='relationship_save_notification')
def relationship_save_notification(sender, instance, *args, **kwargs):
    if instance.notification:
        return
    #instance.full_clean()
    text = '<strong>'+instance.from_person.first_name+' '+instance.from_person.last_name+'</strong> '
    try:
        rel = Relationship.objects.get(from_person=instance.to_person, to_person=instance.from_person)
    except:
        text += "wants to be your friend"
    else:
        text += "has accepted friend request"
        if rel.notification.unread:
            rel.notification.unread = False
            rel.notification.save()
    instance.notification = instance.to_person.notification_set.create(text=text+'.', link='/user/'+instance.from_person.username+'/')

@receiver(post_delete, sender=Relationship, dispatch_uid='relationship_delete_notification')
def relationship_delete_notification(sender, instance, *args, **kwargs):
    if instance.notification:
        instance.notification.delete()


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    link = models.CharField(max_length=150)
    unread = models.BooleanField(default=True)
    created = models.DateTimeField(auto_now_add=True)


def not_forbidden(value):
    if value in ['admin', 'signup', 'social', 'logout', 'api', 'password', 'email', 'user', 'static']:
        raise ValidationError('%s is not permitted as a shortname.' % value)

BUSINESS_TYPE = ((0, 'Restaurant'), (1, 'Tavern'), (2, 'Cafe'), (3, 'Fast food'))

class Business(models.Model):
    shortname = models.CharField(
        'shortname',
        max_length=30,
        unique=True,
        help_text='Maximum 30 characters. Letters, digits and ./-/_ only.',
        validators=[
            validators.RegexValidator(
                r'^[\w.-]+$',
                ('Enter a valid shortname. This value may contain only '
                  'letters, numbers and ./-/_ characters.')
            ),
            not_forbidden,
        ],
        error_messages={
            'unique': "A business with that shortname already exists.",
        },
    )
    manager = models.ForeignKey(User, on_delete=models.CASCADE)
    type = models.IntegerField(choices=BUSINESS_TYPE)
    name = models.CharField(max_length=60)
    phone = PhoneNumberField(blank=True)
    opened = models.TimeField(default=datetime.time(8, 0))
    opened_sat = models.TimeField(null=True, blank=True)
    opened_sun = models.TimeField(null=True, blank=True)
    closed = models.TimeField(default=datetime.time(0, 0))
    closed_sat = models.TimeField(null=True, blank=True)
    closed_sun = models.TimeField(null=True, blank=True)
    # geoloc = ...
    # ...

    def __str__(self):
        return '%s "%s"' % (self.get_type_display(), self.name)


EVENT_MIN_CHAR = 15

class Event(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE)
    text = models.TextField(validators=[MinLengthValidator(EVENT_MIN_CHAR)])
    when = models.DateTimeField(null=True, blank=True)

class Reminder(models.Model):
    person = models.ForeignKey(User, on_delete=models.CASCADE)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    #text = models.TextFeild(blank=True)
    #link = models.CharField(max_length=150, blank=True)
    when = models.DateTimeField()

    class Meta:
        unique_together = (('person', 'event', 'when'),)

class Comment(models.Model):
    person = models.ForeignKey(User, on_delete=models.CASCADE)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    text = models.TextField()

class Like(models.Model):
    person = models.ForeignKey(User, on_delete=models.CASCADE)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    is_dislike = models.BooleanField(default=False)

    class Meta:
        unique_together = (('person', 'event'),)


"""TESTING:
from main.models import User
a = User(username='mikisoft', email='mihailosoft@gmail.com', first_name='Mihailo', last_name='Popović', gender=1, birthdate='***REMOVED***', location=0)
a.set_password('PASSWORD')
a.is_staff = True
a.is_superuser = True
a.save()
# try to login to site
from allauth.account.models import EmailAddress
a = EmailAddress.objects.get(pk=1)
a.primary = True
a.verified = True
a.save()

from main.models import User
a = User.objects.get(pk=1)
a.set_password('123456')
a.save()
a = User.objects.create(username='mikisoft1',email='lololoasadasdd@sdaaadsa.ss',first_name='Miki',last_name='Pop',birthdate='***REMOVED***',location=0)
a.set_password('123456')
a.save()
# try to login to site
from allauth.account.models import EmailAddress
a = EmailAddress.objects.get(pk=2)
a.primary = True
a.verified = True
a.save()
"""