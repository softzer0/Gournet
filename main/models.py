from django.db import models
from django.core.validators import RegexValidator, MinLengthValidator, MaxLengthValidator, MaxValueValidator
from django.utils import timezone
from django.core.mail import send_mail
from django.contrib.auth.models import PermissionsMixin, UserManager
from django.contrib.auth.base_user import AbstractBaseUser
from django.db.models.signals import post_delete, pre_save, post_save
from django.dispatch.dispatcher import receiver
from django.core.exceptions import ValidationError
#from django_thumbs.db.models import ImageWithThumbsField
from phonenumber_field.modelfields import PhoneNumberField
#from django.core.exceptions import FieldError
import datetime, re
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
from django.conf import settings
from functools import lru_cache
from django.contrib.gis.db.models import PointField, GeoManager
from multiselectfield import MultiSelectField
from timezone_field import TimeZoneField
from timezonefinder import TimezoneFinder
from django.utils.translation import ugettext_lazy as _, ugettext, pgettext_lazy, string_concat, override as lang_override
from django.utils.functional import lazy
from os.path import join
from shutil import rmtree
from django.core.urlresolvers import reverse
from rest_framework_simplejwt.utils import datetime_to_epoch
from disposable_email_checker.fields import DisposableEmailField
from pyotp import random_base32

TF_OBJ = TimezoneFinder()

@lru_cache()
def get_has_stars():
    return {ContentType.objects.get(model='item').pk: 'item'}

@lru_cache()
def get_content_types_pk():
    res = []
    try:
        for r in ('business', 'event', 'item', 'comment'): #important
            res.append(ContentType.objects.get(model=r).pk)
    except:
        pass
    return res


CURRENCY = (('RSD', _("Serbian dinar (RSD)")), ('EUR', _("Euro (EUR)")))
CHOICE_GENDER = ((0, _("Male")), (1, _("Female")))

user_short_name = RegexValidator(
                    r'^[\w.-]+$',
                    code=re.ASCII
                )

class Loc(models.Model):
    location = PointField(_("longitude/latitude"), geography=True, error_messages={'invalid': _("Enter valid coordinates.")}) #, geography=True
    loc_projected = PointField(srid=3857)
    address = models.CharField(_("address"), max_length=130)
    tz = TimeZoneField(verbose_name=_("time zone"), default=settings.TIME_ZONE)

    class Meta:
        abstract = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.pk:
            self._location = self.location

    def save(self, *args, **kwargs):
        if not hasattr(self, '_location') or self._location != self.location:
            self.loc_projected = self.location.transform(3857, True)
            self.tz = TF_OBJ.timezone_at(lat=self.location.coords[1], lng=self.location.coords[0])
        super().save(*args, **kwargs)
        self._location = self.location

class MyUserManager(UserManager):
    """def create_user(self, username, email=None, password=None, **extra_fields):
        extra_fields.first_name = extra_fields.first_name.capitalize()
        extra_fields.last_name = extra_fields.last_name.capitalize()
        return super().create_user(username, email, password, **extra_fields)"""

    def get_by_natural_key(self, username):
        return self.get(username__iexact=username)

    def filter_by_natural_key(self, username):
        return self.filter(username__iexact=username)

def get_curr_epoch():
    return datetime_to_epoch(timezone.now())

class User(AbstractBaseUser, Loc, PermissionsMixin):
    """
    An class implementing a fully featured User model with
    admin-compliant permissions.
    """
    username = models.CharField(
        _("username"),
        max_length=30,
        unique=True,
        help_text=string_concat(lazy(lambda c: ugettext("Maximum %d characters.") % c)(30), ' ', _("English alphabet (case-insensitive), digits and ./-/_ only.")),
        validators=[user_short_name],
        error_messages={'unique': _("A user with that username already exists.")},
    )
    first_name = models.CharField(_("first name"), max_length=30, validators=[RegexValidator(r'^[^\W\d_]+$', _("Invalid first name."))]) # Removed 'blank' attribute
    last_name = models.CharField(_("last name"), max_length=30, validators=[RegexValidator(r'^[^\W\d_]+(\-[^\W\d_]+)?$', _("Invalid last name."))]) # Removed 'blank' attribute
    email = DisposableEmailField(_("email address"), unique=True) # Changed from 'blank' to 'unique' attribute

    # Added custom fields [BEGIN]

    #avatar = ImageWithThumbsField(upload_to=upload_to, blank=True, sizes=((48,48),(64,64)))
    friends = models.ManyToManyField('self', blank=True, symmetrical=False, through='Relationship')
    #favourites = models.ManyToManyField('Business', blank=True, related_name='favoured_by')
    #comments = models.ManyToManyField('Event', blank=True, symmetrical=False, through='Comment', related_name='commented_by')

    gender = models.IntegerField(_("gender"), choices=CHOICE_GENDER, default=0)
    birthdate = models.DateField(_("birthdate"))

    name_changed = models.BooleanField(_("name already changed?"), default=False)
    gender_changed = models.BooleanField(_("gender already changed?"), default=False)
    birthdate_changed = models.BooleanField(_("birthdate already changed?"), default=False)
    pass_last_changed = models.BigIntegerField(default=get_curr_epoch)

    currency = models.CharField(_("currency"), choices=CURRENCY, default=settings.DEFAULT_CURRENCY, validators=[MinLengthValidator(3)], max_length=3)
    language = models.CharField(_("language"), choices=settings.LANGUAGES, default=settings.LANGUAGE_CODE, validators=[MinLengthValidator(5)], max_length=7)

    recent = GenericRelation('Recent')

    # Added custom fields [END]

    is_staff = models.BooleanField(
        _("staff status"),
        default=False,
        help_text=_("Designates whether the user can log into this admin site."),
    )
    is_active = models.BooleanField(
        pgettext_lazy('user active', "active"),
        default=True,
        help_text=_("Designates whether this user should be treated as active. Unselect this instead of deleting accounts."),
    )
    is_manager = models.BooleanField(_("is manager?"), default=False)
    date_joined = models.DateTimeField(_("date joined"), default=timezone.now)

    objects = MyUserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'first_name', 'last_name', 'gender', 'birthdate', 'country', 'city'] # Added fields after 'email'

    class Meta:
        swappable = 'AUTH_USER_MODEL'
        ordering = ['username', 'first_name', 'last_name']
        verbose_name = _("user")
        verbose_name_plural = _("users")

    def save(self, *args, **kwargs):
        if self._password:
            self.pass_last_changed = get_curr_epoch()
        self.first_name = self.first_name.capitalize()
        self.last_name = self.last_name.capitalize()
        super().save(*args, **kwargs)

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

def rem_avatar(instance):
    try:
        rmtree(join(settings.MEDIA_ROOT, 'images')+'/'+instance._meta.model_name+'/'+str(instance.pk))
    except:
        pass

@receiver(post_delete, sender=User)
def user_avatar_delete(instance, **kwargs):
    rem_avatar(instance)


class Notification(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE)
    session = models.CharField(max_length=32, null=True, blank=True)
    text = models.TextField()
    link = models.CharField(max_length=150)
    unread = models.BooleanField(default=True)
    created = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created']


class Relationship(models.Model):
    from_person = models.ForeignKey(User, on_delete=models.CASCADE, related_name='from_person')
    to_person = models.ForeignKey(User, on_delete=models.CASCADE, related_name='to_person')
    notification = models.OneToOneField(Notification, null=True, blank=True, on_delete=models.SET_NULL)
    symmetric = models.BooleanField(default=False)

    class Meta:
        unique_together = (('from_person', 'to_person'),)

    def __str__(self):
        return '%s with %s' % (self.from_person.get_username(), self.to_person.get_username())

@receiver(pre_save, sender=Relationship)
def relationship_save_notification(instance, **kwargs):
    """if instance.from_person == instance.to_person:
        raise FieldError("You can't make a relationship with yourself.")"""
    if instance.notification:
        return
    #instance.full_clean()
    text = '<strong>'+instance.from_person.first_name+' '+instance.from_person.last_name+'</strong>'
    with lang_override(instance.to_person.language):
        try:
            rel = Relationship.objects.get(from_person=instance.to_person, to_person=instance.from_person)
        except:
            text = ugettext("%s wants to be your friend.") % text
        else:
            instance.symmetric = True
            text = ugettext("%s has accepted friend request.") % text
            if rel.notification.unread:
                rel.notification.unread = False
                rel.notification.save()
    instance.notification = instance.to_person.notification_set.create(text=text, link=reverse('user_profile', kwargs={'username': instance.from_person.username}))

@receiver(post_delete, sender=Relationship)
def relationship_delete_notification_recent(instance, **kwargs):
    if instance.notification:
        instance.notification.delete()
    Recent.objects.filter(user=instance.from_person, content_type=ContentType.objects.get(model='user'), object_id=instance.to_person.pk).delete()

FORBIDDEN = ('contact', 'static', 'admin', 'signup', 'social', 'logout', 'api', 'password', 'email', 'user', 'images', 'my-business', 'my-orders', 'manage-waiters', 'i18n', 'upload', 'privacy-policy', 'terms-of-service', 'edit.html') # important
def not_forbidden(value):
    if value in FORBIDDEN:
        raise ValidationError(ugettext("\"%s\" is not permitted as a shortname.") % value)

class BusinessManager(GeoManager):
    def get_by_natural_key(self, shortname):
        return self.get(shortname__iexact=shortname)

    def filter_by_natural_key(self, shortname):
        return self.filter(shortname__iexact=shortname)

BUSINESS_TYPE = ((0, _("Restaurant")), (1, _("Tavern")), (2, _("Bistro")), (3, _("Cafe")), (4, _("Pub")), (5, _("Bar")), (6, _("Nightclub")), (7, pgettext_lazy('type of business', "Fast food")))

class WorkTime(models.Model):
    opened = models.TimeField(_("opening time"), default=datetime.time(8, 0))
    opened_sat = models.TimeField(_("opening time on Saturday"), null=True, blank=True)
    opened_sun = models.TimeField(_("opening time on Sunday"), null=True, blank=True)
    closed = models.TimeField(_("closing time"), default=datetime.time(0, 0))
    closed_sat = models.TimeField(_("closing time on Saturday"), null=True, blank=True)
    closed_sun = models.TimeField(_("closing time on Sunday"), null=True, blank=True)

    class Meta:
        abstract = True

def gen_random_secret():
    return random_base32(32)

class Business(Loc, WorkTime):
    shortname = models.CharField(
        _("shortname"),
        max_length=30,
        unique=True,
        error_messages={'unique': _("A business with that shortname already exists.")},
        help_text=string_concat(_("The people could access your business by putting its shortname after the site address, e.g: <u>www.gournet.co/shortname</u>."), '\n', lazy(lambda c: ugettext("Maximum %d characters.") % c)(30), ' ', _("English alphabet (case-insensitive), digits and ./-/_ only.")),
        validators=[user_short_name, not_forbidden]
    )
    manager = models.OneToOneField(User, on_delete=models.CASCADE)
    type = models.SmallIntegerField(_("type"), choices=BUSINESS_TYPE, default=0)
    name = models.CharField(_("first name"), max_length=60, validators=[RegexValidator(r'^(?!\s)(?!.*\s$)(?=.*\w)[\w +.$\-()\'*`\^&#@%\\/<>;:,|\[\]{}~=?!]{1,}$', _("Enter a valid business name."))])
    phone = PhoneNumberField(_("phone number")) #, help_text=_("In national format, e.g: 017448739.")
    currency = models.CharField(_("default currency"), choices=CURRENCY, default=settings.DEFAULT_CURRENCY, validators=[MinLengthValidator(3)], max_length=3)
    supported_curr = MultiSelectField(_("other supported currencies (if any)"), choices=CURRENCY, null=True, blank=True)
    is_published = models.BooleanField(pgettext_lazy("business", "is published?"), default=False)
    table_secret = models.CharField(max_length=32, default=gen_random_secret)
    created = models.DateTimeField(auto_now_add=True)
    likes = GenericRelation('Like')
    recent = GenericRelation('Recent')

    objects = BusinessManager()

    class Meta:
        verbose_name = _("business")
        verbose_name_plural = _("businesses")

    def __str__(self):
        return '%s "%s"' % (self.get_type_display(), self.name)

def check_time(instance):
    t = datetime.time(0, 0)
    for f in ('', '_sat', '_sun'):
        if f != '':
            if getattr(instance, 'opened'+f) and not getattr(instance, 'closed'+f):
                setattr(instance, 'opened'+f, None)
            elif getattr(instance, 'closed'+f) and not getattr(instance, 'opened'+f):
                setattr(instance, 'closed'+f, None)
        if (f == '' or getattr(instance, 'opened'+f)) and getattr(instance, 'opened'+f) == getattr(instance, 'closed'+f) and getattr(instance, 'opened'+f) != t:
            setattr(instance, 'opened'+f, t)
            setattr(instance, 'closed'+f, t)

@receiver(pre_save, sender=Business)
def business_check_time(instance, **kwargs):
    check_time(instance)

@receiver(post_delete, sender=Business)
def business_review_avatar_delete(instance, **kwargs):
    Comment.objects.filter(content_type=ContentType.objects.get(model='business'), object_id=instance.pk).delete()
    rem_avatar(instance)
    instance.manager.is_manager = False
    instance.manager.save()


EVENT_MIN_CHAR = 15

class Event(models.Model):
    business = models.ForeignKey(Business, verbose_name=_("business"), on_delete=models.CASCADE)
    text = models.TextField(_("text"), validators=[MinLengthValidator(EVENT_MIN_CHAR), MaxLengthValidator(1000)])
    when = models.DateTimeField(_("when"))
    created = models.DateTimeField(_("created"), auto_now_add=True)
    likes = GenericRelation('Like')

    objects = GeoManager()

    class Meta:
        ordering = ['-when', '-pk']
        verbose_name = _("event")
        verbose_name_plural = _("events")

    def __str__(self):
        return 'Event #%d on business #%d' % (self.pk, self.business_id)

def cascade_delete(type, pk):
    for model in (EventNotification, Comment):
        qs = model.objects.filter(content_type=ContentType.objects.get(model=type), object_id=pk)
        qs._raw_delete(qs.db)

@receiver(post_delete, sender=Event)
def event_cascade_delete(instance, **kwargs):
    cascade_delete('event', instance.pk)


CATEGORY = (
    (_("Alcoholic beverages"), (
            ('cider', _("Cider")),
            ('whiskey', _("Whiskey")),
            ('wine', _("Wine")),
            ('beer', _("Beer")),
            ('vodka', _("Vodka")),
            ('brandy', pgettext_lazy('singular', "Brandy")),
            ('liqueur', _("Liqueur")),
            ('cocktail', _("Cocktail")),
            ('tequila', _("Tequila")),
            ('gin', _("Gin")),
            ('rum', _("Rum"))
        )
     ),
    (_("Other drinks"), (
            ('coffee', _("Coffee")),
            ('soft_drink', _("Soft drink")),
            ('juice', _("Juice")),
            ('tea', _("Tea")),
            ('hot_chocolate', _("Hot chocolate")),
            ('water', pgettext_lazy('singular', "Water")),
            ('drinks_other', _("Other"))
        )
    ),
    (_("Food"), (
            ('fast_food', pgettext_lazy('singular', "Fast food")),
            ('sandwich', _("Sandwich")),
            ('pizza', _("Pizza")),
            ('pasta', _("Pasta")),
            ('pastry', _("Pastry")),
            ('breakfast', _("Breakfast")),
            ('appetizer', _("Appetizer")),
            ('soup_stew', _("Soup, stew")),
            ('meal', _("Meal")),
            ('barbecue', pgettext_lazy('singular', "Barbecue")),
            ('seafood_fish', _("Seafood, fish dish")),
            ('additive', _("Food additive")),
            ('salad', _("Salad")),
            ('dessert', _("Dessert")),
            ('food_other', _("Other"))
        )
    )
)
ITEM_MIN_CHAR = 2

class Item(models.Model):
    ordering = models.IntegerField(null=True, blank=True)
    business = models.ForeignKey(Business, verbose_name=_("business"), on_delete=models.CASCADE)
    category = models.CharField(_("category"), choices=CATEGORY, validators=[MinLengthValidator(3)], max_length=19) #important
    name = models.CharField(_("name"), validators=[MinLengthValidator(ITEM_MIN_CHAR)], max_length=60)
    price = models.DecimalField(_("price"), max_digits=8, decimal_places=2)
    created = models.DateTimeField(pgettext_lazy("item/comment/review", "created on"), auto_now_add=True)
    has_image = models.BooleanField(_("has image?"), default=False)
    likes = GenericRelation('Like')

    class Meta:
        ordering = ['business', 'category', 'ordering']
        unique_together = (('business', 'name', 'category'),)
        #ordering = ['category', 'name', 'price']
        verbose_name = _("item")
        verbose_name_plural = _("items")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.pk:
            self._ordering = self.ordering

    def __str__(self):
        return '%s: %s (%s %s)' % (self.get_category_display(), self.name, self.price, self.business.currency)

@receiver(post_delete, sender=Item)
def item_cascade_and_avatar_delete(instance, **kwargs):
    cascade_delete('item', instance.pk)
    rem_avatar(instance)

@receiver(pre_save, sender=Item)
def item_set_order(instance, **kwargs):
    if instance.ordering is None:
        instance.ordering = instance.business.item_set.filter(category=instance.category).count()

@receiver(post_save, sender=Item)
def item_reorder_notify_published(instance, created, **kwargs):
    if created:
        Item.objects.filter(business=instance.business, category=instance.category, ordering__gt=instance.ordering).update(ordering=models.F('ordering') + 1)
        # if instance.business.item_set.count() == 1:
            # User.objects.get(username='mikisoft').email_user('', 'https://gournet.co/'+instance.business.shortname+'/')
            #instance.business.is_published = True
            #instance.business.save()
    elif instance.ordering != instance._ordering:
        Item.objects.filter(business=instance.business, category=instance.category, **{'ordering__' + ('gte' if instance.ordering < instance._ordering else 'lte'): instance.ordering, 'ordering__' + ('lt' if instance.ordering < instance._ordering else 'gt'): instance._ordering}).exclude(pk=instance.pk).update(ordering=models.F('ordering') + (1 if instance.ordering < instance._ordering else -1))


class Waiter(WorkTime):
    person = models.ForeignKey(User, on_delete=models.CASCADE)
    table = models.ForeignKey('Table', on_delete=models.CASCADE)

    def __str__(self):
        return '%s @ %s' % (self.person, self.table)

@receiver(pre_save, sender=Waiter)
def waiter_check_time(instance, **kwargs):
    check_time(instance)

class Table(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE)
    number = models.PositiveSmallIntegerField()
    waiters = models.ManyToManyField(User, through=Waiter)
    counter = models.PositiveIntegerField(default=0)

    def __str__(self):
        return '%s: Table #%s (@%s)' % (self.business, self.number, self.counter)

class OrderedItem(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    order = models.ForeignKey('Order', on_delete=models.CASCADE)
    quantity = models.PositiveSmallIntegerField(default=1)

    def __str__(self):
        return 'Item [%s] x%s' % (self.item, self.quantity)

class Order(models.Model):
    person = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    session = models.CharField(max_length=32, null=True, blank=True)
    table = models.ForeignKey(Table, on_delete=models.CASCADE)
    ordered_items = models.ManyToManyField(Item, through=OrderedItem)
    created = models.DateTimeField(pgettext_lazy("item/comment/review", "created on"), auto_now_add=True)
    delivered = models.DateTimeField(pgettext_lazy("order", "delivered on"), null=True, blank=True)
    request_type = models.IntegerField(_("request for payment"), choices=((0, _("Cash")), (1, _("Credit card"))), null=True, blank=True)
    requested = models.DateTimeField(pgettext_lazy("order", "requested on"), null=True, blank=True)
    paid = models.DateTimeField(pgettext_lazy("order", "paid on"), null=True, blank=True)

    class Meta:
        ordering = ['-delivered', '-created']

    def __str__(self):
        return 'Items [%s], table [%s]' % (self.ordereditem_set.all(), self.table)


class CT(models.Model):
    content_type = models.ForeignKey(ContentType, verbose_name=_("object type"), limit_choices_to={'pk__in': get_content_types_pk()})
    object_id = models.PositiveIntegerField(_("object ID"))
    content_object = GenericForeignKey('content_type', 'object_id')

    class Meta:
        abstract = True

REVIEW_STATUS = ((0, _("Started")), (1, _("Closed")), (2, _("Completed")), (3, _("Declined")), (4, _("Under review")), (5, _("Planned")), (6, _("Archived")), (7, _("Need feedback")))

class Comment(CT):
    person = models.ForeignKey(User, verbose_name=_("person"), on_delete=models.CASCADE)
    text = models.TextField(_("text"), validators=[MaxLengthValidator(1000)])
    created = models.DateTimeField(pgettext_lazy("item/comment/review", "created on"), auto_now_add=True)
    stars = models.PositiveSmallIntegerField(_("stars"), validators=[MaxValueValidator(5)], null=True, blank=True)
    main_comment = models.ForeignKey('Comment', verbose_name=_("main comment"), null=True, blank=True, on_delete=models.SET_NULL)
    status = models.SmallIntegerField(_("status"), choices=REVIEW_STATUS, null=True, blank=True)
    likes = GenericRelation('Like')

    class Meta:
        ordering = ['-created']
        """verbose_name = _("comment/review")
        verbose_name_plural = _("comments/reviews")"""

    def __str__(self):
        return 'User %s, review (#%d) on business #%d%s%s' % (self.person.username, self.pk, self.object_id, ', with main comment #'+str(self.main_comment_id) if self.main_comment else '', ', status: '+self.get_status_display() if self.status is not None else '') if self.content_type.model == 'business' else 'User %s, comment (#%d) on %s #%d' % (self.person.username, self.pk, self.content_type.model if self.content_type != ContentType.objects.get(model='comment') else 'review', self.object_id)

def increment(model, filter):
    obj, created = model.objects.get_or_create(**filter)
    if not created:
        obj.count = models.F('count') + 1
        obj.save()

def create_notif(from_person, ct, obj_pk, to_person, typ):
    increment(EventNotification, {'from_person': from_person, 'content_type': ct, 'object_id': obj_pk, 'to_person': to_person, 'comment_type': typ})

@receiver(post_save, sender=Comment)
def comment_save_notification(instance, created, **kwargs):
    if not created:
        return
    bc = 2 if isinstance(instance.content_object, Business) else 1 if isinstance(instance.content_object, Comment) else 0
    if bc == 1 and instance.status is not None:
        instance.content_object.main_comment = instance
        instance.content_object.save()
    ct = ContentType.objects.get(model='comment') if bc == 2 else instance.content_type
    obj_pk = instance.pk if bc == 2 else instance.object_id
    # noinspection PyUnresolvedReferences
    manager = instance.content_object.manager if bc == 2 else instance.content_object.content_object.manager if bc == 1 else instance.content_object.business.manager
    if instance.person != manager:
        create_notif(instance.person, ct, obj_pk, manager, bc)
    if bc == 1 and instance.person != instance.content_object.person: #instance.person == manager
        create_notif(instance.person, ct, obj_pk, instance.content_object.person, 0)

def del_notif(from_person, ct, obj_pk, to_person):
    EventNotification.objects.filter(count__gt=0, from_person=from_person, content_type=ct, object_id=obj_pk, to_person=to_person).update(count=models.F('count') - 1)
    EventNotification.objects.filter(count=0).delete()

@receiver(post_delete, sender=Comment)
def comment_cascade_delete(instance, **kwargs):
    del_notif(instance.person, instance.content_type, instance.object_id, instance.content_object.manager if isinstance(instance.content_object, Business) else instance.content_object.content_object.manager if isinstance(instance.content_object, Comment) else instance.content_object.business.manager)
    if isinstance(instance.content_object, Comment):
        if instance.person != instance.content_object.person:
            del_notif(instance.person, instance.content_type, instance.object_id, instance.content_object.person)
    elif isinstance(instance.content_object, Business):
        cascade_delete('comment', instance.pk)


class Like(CT):
    person = models.ForeignKey(User, on_delete=models.CASCADE)
    is_dislike = models.BooleanField(default=False)
    stars = models.PositiveSmallIntegerField(validators=[MaxValueValidator(5)], null=True, blank=True)
    date = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = (('person', 'content_type', 'object_id'),)
        ordering = ['-date']

    def __str__(self):
        return 'User %s, %s on %s #%d' % (self.person.username, 'dislike' if self.is_dislike else 'like' if self.content_type_id not in get_has_stars() else str(self.stars)+' stars', self.content_type.model, self.object_id)

@receiver(post_delete, sender=Like)
def like_delete_recent(instance, **kwargs):
    if instance.content_type.model == 'business':
        Recent.objects.filter(user=instance.person, content_type=ContentType.objects.get(model='business'), object_id=instance.object_id).delete()


class EventNotification(CT):
    from_person = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notify_from_person', blank=True, null=True)
    to_person = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notify_to_person')
    comment_type = models.PositiveSmallIntegerField(blank=True, null=True)
    when = models.DateTimeField(auto_now_add=True)
    count = models.PositiveSmallIntegerField(default=1)

    class Meta:
        unique_together = (('from_person', 'to_person', 'content_type', 'object_id', 'comment_type'),)
        ordering = ['comment_type', 'content_type', 'from_person', 'object_id', 'when']


class Recent(CT):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateTimeField(auto_now=True)
    count = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['-date', '-count']


"""TESTING:
from main.models import User
from django.contrib.gis.geos import Point
a = User.objects.get(pk=1)
a.username = 'user'
a.set_password('1')
a.save()
a = User.objects.create(username='manager',email='lololoasadasdd@sdaaadsa.ss',first_name='Miki',last_name='Pop',birthdate='***REMOVED***',address='Vranje, Srbija',location=Point(21.9002712, 42.5450345, srid=4326))
a.set_password('1')
a.save()
# try to login to site
from allauth.account.models import EmailAddress
a = EmailAddress.objects.get(pk=2)
a.primary = True
a.verified = True
a.save()
"""
