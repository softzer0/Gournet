from django.db import models
from django.core import validators
from django.utils import timezone
from django.core.mail import send_mail
from django.contrib.auth.models import PermissionsMixin, UserManager
from django.contrib.auth.base_user import AbstractBaseUser
from django.db.models.signals import post_delete, pre_save
from django.dispatch.dispatcher import receiver
#from django_thumbs.db.models import ImageWithThumbsField

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
    gender = models.IntegerField('gender', choices=CHOICE_GENDER, default=1)
    birthdate = models.DateField('birthdate')
    country = models.CharField('country', max_length=25)
    city = models.CharField('city', max_length=75)

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
    person1 = models.ForeignKey(User, on_delete=models.CASCADE, related_name="person1")
    person2 = models.ForeignKey(User, on_delete=models.CASCADE, related_name="person2")
    notification = models.OneToOneField('Notification', null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        unique_together = (('person1', 'person2'),)

    """def save(self, *args, **kwargs):
        if self.person1 == self.person2:
            return
        else:
            super().save(*args, **kwargs)"""

    def __str__(self):
        return '%s with %s' % (self.person1.get_username(), self.person2.get_username())

@receiver(pre_save, sender=Relationship, dispatch_uid='relationship_save_notification')
def relationship_save_notification(sender, instance, *args, **kwargs):
    if instance.notification:
        return
    #instance.full_clean()
    text = '<strong>'+instance.person1.first_name+' '+instance.person1.last_name+'</strong> '
    try:
        rel = Relationship.objects.get(person1=instance.person2, person2=instance.person1)
    except:
        text += "wants to be your friend"
    else:
        text += "has accepted friend request"
        if rel.notification.unread:
            rel.notification.unread = False
            rel.notification.save()
    instance.notification = instance.person2.notification_set.create(text=text+'.', link='user/'+instance.person1.username)

@receiver(post_delete, sender=Relationship, dispatch_uid='relationship_delete_notification')
def relationship_delete_notification(sender, instance, *args, **kwargs):
    if instance.notification:
        instance.notification.delete()

class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.CharField(max_length=50)
    link = models.CharField(max_length=50)
    unread = models.BooleanField(default=True)
    created = models.DateTimeField(auto_now_add=True)

"""TESTING:
from main.models import User
a = User(username='mikisoft', email='mihailosoft@gmail.com', gender=1, birthdate='***REMOVED***', country='Serbia', city='Vranje')
a.set_password('PASSWORD')
a.is_staff = True
a.is_superuser = True
a.save()
# try to login to site
from allauth.account.models import EmailAddress
a = EmailAddress.objects.get(pk=1)
a.verified = True
a.save()

from main.models import User
a = User.objects.get(pk=1)
a.set_password('123456')
a.save()
a = User.objects.create(username='mikisoft1',email='lololoasadasdd@sdaaadsa.ss',first_name='Miki',last_name='Pop',birthdate='***REMOVED***',country='Sdweads',city='Dsadtfrwea')
a.set_password('123456')
a.save()
# try to login to site
from allauth.account.models import EmailAddress
a = EmailAddress.objects.get(pk=2)
a.verified = True
a.save()
"""