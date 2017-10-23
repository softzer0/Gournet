from django import forms
from .models import CATEGORY, Business, Loc
from phonenumber_field.widgets import PhoneNumberInternationalFallbackWidget
from geopy import GoogleV3
from django.contrib.gis.geos import fromstr, Point
from rest_framework.serializers import ValidationError
from django.utils.translation import ugettext as _, ugettext_lazy, pgettext, get_language
from captcha.fields import ReCaptchaField
from django.conf import settings

SHORTNAME_EXISTS_MSG = ugettext_lazy("A business with that shortname already exists.")
COORDINATES_NOT_FOUND_MSG = ugettext_lazy("Either coordinates for specified address are not found, or there's some internal error.")
GOOGLEV3_OBJ = GoogleV3(api_key=settings.GMAPS_API_KEY)

def clean_loc(self, cleaned_data, noloc=False, retraw=False):
    loc = cleaned_data.get('location', False) if not noloc else False
    try:
        if loc and not cleaned_data.get('address', False):
            data = GOOGLEV3_OBJ.reverse(cleaned_data['location'].split(',')[1]+','+cleaned_data['location'].split(',')[0], exactly_one=True).address
            if isinstance(self, forms.ModelForm):
                cleaned_data['address'] = data
        elif cleaned_data.get('address', False) and not loc:
            loc = GOOGLEV3_OBJ.geocode(cleaned_data['address'], exactly_one=True)
            cleaned_data['location'] = Point(loc.longitude, loc.latitude, srid=4326)
            if noloc:
                cleaned_data['address'] = loc.raw['formatted_address']
    except:
        loc = None
        pass
    if not loc:
        f = 'address' if 'username' in cleaned_data else 'location'
        if isinstance(self, forms.ModelForm):
            if cleaned_data.get('address', False) or cleaned_data.get('location', False):
                self.add_error(f, forms.ValidationError(COORDINATES_NOT_FOUND_MSG))
        else:
            raise ValidationError({f: [COORDINATES_NOT_FOUND_MSG]})
    if retraw and loc:
        return loc.raw

def business_clean_data(self, cleaned_data, upd=False):
    if cleaned_data.get('name', False):
        cleaned_data['name'] = cleaned_data['name'].replace('"', '\'')
    if cleaned_data.get('supported_curr', False) and cleaned_data.get('currency', False):
        try:
            cleaned_data['supported_curr'].remove(cleaned_data['currency'])
        except:
            pass
    if not isinstance(self, forms.ModelForm) and cleaned_data.get('shortname', False) and Business.objects.filter_by_natural_key(cleaned_data['shortname']).exists():
        raise ValidationError({'shortname': [SHORTNAME_EXISTS_MSG]})
    if cleaned_data.get('location', False):
        cleaned_data['location'] = fromstr('POINT('+cleaned_data['location'].replace(',', ' ')+')')
    if isinstance(self, forms.ModelForm) or 'address' in cleaned_data or 'location' in cleaned_data:
        clean_loc(self, cleaned_data)
    if upd:
        return
    if cleaned_data.get('opened_sun', False) and not cleaned_data.get('opened_sat', False):
        cleaned_data.pop('closed_sat', None)
        cleaned_data.pop('opened_sun', None)
        cleaned_data.pop('closed_sun', None)

class DummyCategory(forms.Form):
    cat = forms.ChoiceField(label='', choices=CATEGORY)

class BaseForm(forms.ModelForm):
    address = forms.CharField(required=False, max_length=130)
    location = forms.RegexField(r'^-?[\d]+(?:\.[\d]+)?,-?[\d]+(?:\.?[\d]+)?$')

    class Meta:
        exclude = ('type', 'name', 'shortname', 'currency', 'manager', 'is_published', 'tz', 'loc_projected')
        model = Business
        widgets = {'phone': PhoneNumberInternationalFallbackWidget, 'supported_curr': forms.SelectMultiple}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        not_b = not isinstance(self, BusinessForm)
        if not_b:
            self.fields['phone'].widget.attrs['ng-model'] = 'data.form[1]'
            self.fields['supported_curr'].widget.attrs['ng-model'] = 'data.form[2]'
            self.fields['address'].widget.attrs['ng-model'] = 'ngModel'
            for f in ('phone', 'supported_curr', 'address'):
                self.fields[f].widget.attrs['ng-disabled'] = 'data.disabled'
        else:
            self.fields['shortname'].error_messages['unique'] = SHORTNAME_EXISTS_MSG
            self.fields['location'].widget.attrs['ng-initial'] = ''
        for f in ('phone', 'location'):
            self.fields[f].widget.attrs['title'] = ''
        for f in ('address', 'location'):
            self.fields[f].label = Loc._meta.get_field(f).verbose_name.capitalize()
        self.fields['location'].widget.attrs['geom_type'] = ''
        self.fields['location'].widget.attrs['ng-model'] = 'data.form[4]' if not_b else 'location'
        self.fields['location'].widget.attrs['readonly'] = True
        self.fields['location'].help_text = _("You have to adjust the exact location using the map with a marker below.")
        for i, f in enumerate(tuple(('opened', 'closed', 'opened_sat', 'closed_sat', 'opened_sun', 'closed_sun'))):
            self.fields[f].widget.attrs['value'] = ''
            self.fields[f].widget.attrs['ng-model'] = ('data.form[0]' if not_b else 'date')+'['+str(i)+']'
            if not_b:
                self.fields[f].widget.attrs['ng-disabled'] = 'data.disabled'
            else:
                self.fields[f].widget.attrs['ng-initial'] = i
            self.fields[f].widget.attrs['datetime'] = 'HH:mm'
            self.fields[f].widget.format = '%H:%M'
            if i > 1:
                if i % 2 == 0:
                    self.fields[f].label = self.fields['opened'].label
                else:
                    self.fields[f].label = self.fields['closed'].label

class BusinessForm(BaseForm):
    class Meta:
        exclude = ('manager', 'is_published', 'tz', 'loc_projected')
        model = Business
        widgets = {'phone': PhoneNumberInternationalFallbackWidget, 'supported_curr': forms.SelectMultiple}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['type'].label = _("Type of your business")
        self.fields['name'].label = pgettext("name of business", "Its name")
        self.fields['name'].widget.attrs['placeholder'] = Business._meta.get_field('name').verbose_name.capitalize()
        self.fields['name'].widget.attrs['ng-model'] = 'name'
        for f in ('name', 'shortname', 'address'):
            self.fields[f].widget.attrs['ng-initial'] = ''
        self.fields['name'].widget.attrs['ng-change'] = 'genshort()'
        self.fields['shortname'].label = _("Shortname (a part of the URL)")
        self.fields['shortname'].widget.attrs['placeholder'] = Business._meta.get_field('shortname').verbose_name.capitalize()
        self.fields['shortname'].widget.attrs['title'] = ''
        self.fields['shortname'].widget.attrs['ng-model'] = 'shortname'

    def clean(self):
        business_clean_data(self, super().clean())

class CaptchaForm(forms.Form):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['captcha'] = ReCaptchaField(attrs={'lang': get_language()}) #enable

class ContactForm(CaptchaForm):
    email = forms.EmailField(label=ugettext_lazy("Send replies to"), widget=forms.widgets.TextInput(attrs={'placeholder': ugettext_lazy("E-mail Address")}))
    message = forms.CharField(label=ugettext_lazy("Message"), min_length=20, widget=forms.widgets.Textarea(attrs={'rows': 10, 'placeholder': ugettext_lazy("Enter message here...")}))
