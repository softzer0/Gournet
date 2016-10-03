from django.db import models
from django.core.validators import RegexValidator, MinLengthValidator, MaxValueValidator
from django.utils import timezone
from django.core.mail import send_mail
from django.contrib.auth.models import PermissionsMixin, UserManager
from django.contrib.auth.base_user import AbstractBaseUser
from django.db.models.signals import pre_delete, post_delete, pre_save, post_save
from django.dispatch.dispatcher import receiver
from django.core.exceptions import ValidationError
#from django_thumbs.db.models import ImageWithThumbsField
from phonenumber_field.modelfields import PhoneNumberField
from django.core.exceptions import FieldError
import datetime
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.conf import settings

CHOICE_GENDER = ((0, 'Male'), (1, 'Female'))
SUPPORTED_PLACES = ((0, "Serbia, Vranje"),)

alphabet_only = RegexValidator(r'^[^\W\d_]+$', "Only letters from the alphabet are allowed.")

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
            RegexValidator(
                r'^[\w.-]+$',
                ('Enter a valid username. This value may contain only '
                  'letters, numbers and ./-/_ characters.')
            ),
        ],
        error_messages={
            'unique': "A user with that username already exists.",
        },
    )
    first_name = models.CharField('first name', max_length=30, validators=[alphabet_only]) # Removed "blank" attribute
    last_name = models.CharField('last name', max_length=30, validators=[alphabet_only]) # Removed "blank" attribute
    email = models.EmailField('email address', unique=True) # Changed from "blank" to "unique" attribute

    # Added custom fields [BEGIN]

    #avatar = ImageWithThumbsField(upload_to=upload_to, blank=True, sizes=((48,48),(64,64)))
    friends = models.ManyToManyField('self', blank=True, symmetrical=False, through='Relationship')
    #favourites = models.ManyToManyField('Business', blank=True, related_name='favoured_by')
    #comments = models.ManyToManyField('Event', blank=True, symmetrical=False, through='Comment', related_name='commented_by')

    gender = models.IntegerField('gender', choices=CHOICE_GENDER, default=0)
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


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    link = models.CharField(max_length=150)
    unread = models.BooleanField(default=True)
    created = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created']


class Relationship(models.Model):
    from_person = models.ForeignKey(User, on_delete=models.CASCADE, related_name="from_person")
    to_person = models.ForeignKey(User, on_delete=models.CASCADE, related_name="to_person")
    notification = models.OneToOneField(Notification, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        unique_together = (('from_person', 'to_person'),)

    def __str__(self):
        return '%s with %s' % (self.from_person.get_username(), self.to_person.get_username())

@receiver(pre_save, sender=Relationship, dispatch_uid='relationship_save_notification')
def relationship_save_notification(instance, **kwargs):
    if instance.from_person == instance.to_person:
        raise FieldError("You can't make a relationship with yourself.")
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
def relationship_delete_notification(instance, **kwargs):
    if instance.notification:
        instance.notification.delete()


CURRENCY = (('RSD', "Serbian dinars"), ('EUR', "Euros"))

class Currency(models.Model):
    name = models.CharField(choices=CURRENCY, validators=[MinLengthValidator(3)], max_length=3)

    def __str__(self):
        return self.name


def not_forbidden(value):
    if value in ['admin', 'signup', 'social', 'logout', 'api', 'password', 'email', 'user', 'static', 'media']:
        raise ValidationError('"%s" is not permitted as a shortname.' % value)

BUSINESS_TYPE = ((0, "Restaurant"), (1, "Tavern"), (2, "Bistro"), (3, "Cafe"), (4, "Pub"), (5, "Bar"), (6, "Nightclub"), (7, "Fast food"))

class Business(models.Model):
    shortname = models.CharField(
        'shortname',
        max_length=30,
        unique=True,
        help_text='Maximum 30 characters. Letters, digits and ./-/_ only.',
        validators=[
            RegexValidator(
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
    manager = models.OneToOneField(User, on_delete=models.CASCADE)
    type = models.IntegerField(choices=BUSINESS_TYPE)
    name = models.CharField(max_length=60, validators=[
            RegexValidator(
                r'^(?!\s)(?!.*\s$)(?=.*\w)[\w \.&@\-\'"~?!]{2,}$',
                ('Enter a valid business name. This value may contain only '
                  'letters, numbers and ./-/_/&/"/\'/?/!/~/@ characters.')
            ),
        ])
    phone = PhoneNumberField(blank=True)
    opened = models.TimeField(default=datetime.time(8, 0))
    opened_sat = models.TimeField(null=True, blank=True)
    opened_sun = models.TimeField(null=True, blank=True)
    closed = models.TimeField(default=datetime.time(0, 0))
    closed_sat = models.TimeField(null=True, blank=True)
    closed_sun = models.TimeField(null=True, blank=True)
    currency = models.CharField(choices=CURRENCY, default='RSD', validators=[MinLengthValidator(3)], max_length=3)
    supported_curr = models.ManyToManyField(Currency, blank=True)
    # geoloc = ...
    # ...

    def __str__(self):
        return '%s "%s"' % (self.get_type_display(), self.name)

settings.CONTENT_TYPES['business'] = ContentType.objects.get(model='business')

EVENT_MIN_CHAR = 15

class Event(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE)
    text = models.TextField(validators=[MinLengthValidator(EVENT_MIN_CHAR)])
    when = models.DateTimeField()

    def __str__(self):
        return 'Event #%d on business #%d' % (self.pk, self.business_id)

settings.CONTENT_TYPES['event'] = ContentType.objects.get(model='event')

def cascade_delete(type, pk):
    for model in [EventNotification, Like, Comment]:
        qs = model.objects.filter(content_type=settings.CONTENT_TYPES[type], object_id=pk)
        qs._raw_delete(qs.db)

@receiver(pre_delete, sender=Event, dispatch_uid='event_cascade_delete')
def event_cascade_delete(instance, **kwargs):
    cascade_delete('event', instance.pk)


CATEGORY = (
    ("Alcoholic beverages", (
            ('cider', "Cider"),
            ('whiskey', "Whiskey"),
            ('wine', "Wine"),
            ('beer', "Beer"),
            ('vodka', "Vodka"),
            ('brandy', "Brandy"),
            ('liqueur', "Liqueur"),
            ('cocktail', "Cocktail"),
            ('tequila', "Tequila"),
            ('gin', "Gin"),
            ('rum', "Rum")
        )
     ),
    ("Other drinks", (
            ('coffee', "Coffee"),
            ('soft_drink', "Soft drink"),
            ('juice', "Juice"),
            ('tea', "Tea"),
            ('hot_chocolate', "Hot chocolate"),
            ('water', "Water")
        )
    ),
    ("Food", (
            ('fast_food', "Fast food"),
            ('appetizer', "Appetizer"),
            ('soup', "Soup"),
            ('meal', "Meal"),
            ('barbecue', "Barbecue"),
            ('seafood', "Seafood"),
            ('salad', "Salad"),
            ('dessert', "Dessert")
        )
    )
)
ITEM_MIN_CHAR = 2

class Item(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE)
    category = models.CharField(choices=CATEGORY, validators=[MinLengthValidator(3)], max_length=13)
    name = models.CharField(validators=[MinLengthValidator(ITEM_MIN_CHAR)], max_length=60)
    price = models.DecimalField(max_digits=7, decimal_places=2)

    class Meta:
        unique_together = (('business', 'name'),)
        ordering = ['category', 'name', 'price']

    def __str__(self):
        return '%s: %s (%s %s)' % (self.get_category_display(), self.name, self.price, self.business.currency)

settings.CONTENT_TYPES['item'] = ContentType.objects.get(model='item')
settings.HAS_STARS[settings.CONTENT_TYPES['item'].pk] = 'item'

@receiver(pre_delete, sender=Item, dispatch_uid='item_cascade_delete')
def item_cascade_delete(instance, **kwargs):
    cascade_delete('item', instance.pk)

REVIEW_STATUS = ((0, "Started"), (1, "Closed"), (2, "Completed"), (3, "Declined"), (4, "Under review"), (5, "Planned"), (6, "Archived"), (7, "Need feedback"))

settings.CONTENT_TYPES['comment'] = ContentType.objects.get(model='comment')
CONTENT_TYPES_PK = [ct.pk for ct in settings.CONTENT_TYPES.values()]

class Comment(models.Model):
    person = models.ForeignKey(User, on_delete=models.CASCADE)
    content_type = models.ForeignKey(ContentType, limit_choices_to={'pk__in': CONTENT_TYPES_PK})
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    text = models.TextField()
    created = models.DateTimeField(auto_now_add=True)
    stars = models.PositiveSmallIntegerField(validators=[MaxValueValidator(5)], null=True, blank=True)
    main_comment = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL)
    status = models.IntegerField(choices=REVIEW_STATUS, null=True, blank=True)

    def __str__(self):
        return 'User %s, review (#%d) on business #%d%s%s' % (self.person.username, self.pk, self.object_id, ', with main comment #'+str(self.main_comment_id) if self.main_comment else '', ', status: '+self.get_status_display() if self.status is not None else '') if self.content_type.model == 'business' else 'User %s, comment (#%d) on %s #%d' % (self.person.username, self.pk, self.content_type.model if self.content_type.model != 'comment' else 'review', self.object_id)

def prep_obj(instance):
    business = isinstance(instance.content_object, Business)
    ct = settings.CONTENT_TYPES['comment'] if business else instance.content_type
    obj_pk = instance.pk if business else instance.object_id
    manager = instance.content_object.manager if business else instance.content_object.content_object.manager if isinstance(instance.content_object, Comment) else instance.content_object.business.manager
    is_comment = None if business else True
    return ct, obj_pk, manager, is_comment

@receiver(post_save, sender=Comment, dispatch_uid='comment_save_notification')
def comment_save_notification(instance, created, **kwargs):
    if created:
        if instance.content_type.model == 'comment' and instance.status is not None:
            instance.content_object.main_comment = instance
            instance.content_object.save()
        ct, obj_pk, manager, is_comment = prep_obj(instance)
        if not EventNotification.objects.filter(from_person=instance.person, content_type=ct, object_id=obj_pk, to_person=manager if instance.person != manager else instance.content_object.person, is_comment=is_comment).exists():
            EventNotification.objects.create(from_person=instance.person, content_type=ct, object_id=obj_pk, to_person=manager if instance.person != manager else instance.content_object.person, is_comment=is_comment)

@receiver(pre_delete, sender=Comment, dispatch_uid='comment_cascade_delete')
def comment_cascade_delete(instance, **kwargs):
    if instance.content_type.model != 'business':
        try:
            EventNotification.objects.get(from_person=instance.person, content_type=instance.content_type, object_id=instance.object_id, to_person=(instance.content_object.content_object.manager if instance.person != instance.content_object.content_object.manager else instance.content_object.person) if isinstance(instance.content_object, Comment) else instance.content_object.business.manager, is_comment=True).delete()
        except:
            pass
    else:
        cascade_delete('comment', instance.pk)

class Like(models.Model):
    person = models.ForeignKey(User, on_delete=models.CASCADE)
    content_type = models.ForeignKey(ContentType, limit_choices_to={'pk__in': CONTENT_TYPES_PK})
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    is_dislike = models.BooleanField(default=False)
    stars = models.PositiveSmallIntegerField(validators=[MaxValueValidator(5)], null=True, blank=True)

    class Meta:
        unique_together = (('person', 'content_type', 'object_id'),)

    def __str__(self):
        return 'User %s, %s on %s #%d' % (self.person.username, 'dislike' if self.is_dislike else 'like' if self.content_type_id not in settings.HAS_STARS else str(self.stars)+' stars', self.content_type.model, self.object_id)


class EventNotification(models.Model):
    from_person = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notify_from_person")
    to_person = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notify_to_person")
    content_type = models.ForeignKey(ContentType, limit_choices_to={'pk__in': CONTENT_TYPES_PK})
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    is_comment = models.NullBooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (('from_person', 'to_person', 'content_type', 'object_id', 'is_comment'),)
        ordering = ['from_person', 'content_type', 'object_id', 'pk']

class Reminder(models.Model):
    person = models.ForeignKey(User, on_delete=models.CASCADE)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    when = models.DateTimeField()

    class Meta:
        unique_together = (('person', 'event', 'when'),)

    def __str__(self):
        return str(self.pk)


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