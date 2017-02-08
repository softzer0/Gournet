from django import forms
from .models import CATEGORY, Business
from phonenumber_field.widgets import PhoneNumberInternationalFallbackWidget
from geopy import GoogleV3
from django.contrib.gis.geos import fromstr, Point
from rest_framework.serializers import ValidationError

SHORTNAME_EXISTS_MSG = "A business with that shortname already exists."
COORDINATES_NOT_FOUND_MSG = "Either coordinates for specified address are not found, or there's some internal error."
GOOGLEV3_OBJ = GoogleV3() #api=

def clean_loc(self, cleaned_data, noloc=False, retraw=False):
    loc = cleaned_data.get('location', False) if not noloc else False
    try:
        if loc and not cleaned_data.get('address', False):
            data = GOOGLEV3_OBJ.reverse(cleaned_data['location'])[0].address
            if isinstance(self, forms.ModelForm):
                cleaned_data['address'] = data
        elif cleaned_data.get('address', False) and not loc:
            loc = GOOGLEV3_OBJ.geocode(cleaned_data['address'])
            cleaned_data['location'] = Point(loc.longitude, loc.latitude, srid=4326)
            if noloc:
                cleaned_data['address'] = loc.raw['formatted_address']
    except:
        loc = None
        pass
    if not loc:
        f = 'location' if 'shortname' in cleaned_data else 'address'
        if isinstance(self, forms.ModelForm):
            self.add_error(f, forms.ValidationError(COORDINATES_NOT_FOUND_MSG, code='required'))
        else:
            raise ValidationError({f: [COORDINATES_NOT_FOUND_MSG]})
    if retraw and loc:
        return loc.raw

def business_clean_data(self, cleaned_data):
    if cleaned_data.get('name', False):
        cleaned_data['name'] = cleaned_data['name'].replace('"', '\'')
    if cleaned_data.get('supported_curr', False) and cleaned_data.get('currency', False):
        try:
            cleaned_data['supported_curr'].remove(cleaned_data['currency'])
        except:
            pass
    if cleaned_data.get('shortname', False) and Business.objects.filter_by_natural_key(cleaned_data['shortname']).exists():
        if isinstance(self, forms.ModelForm):
            self.add_error('shortname', forms.ValidationError(SHORTNAME_EXISTS_MSG, code='unique'))
        else:
            raise ValidationError({'shortname': [SHORTNAME_EXISTS_MSG]})
    if cleaned_data.get('location', False):
        cleaned_data['location'] = fromstr('POINT('+cleaned_data['location'].replace(',', ' ')+')')
    if isinstance(self, forms.ModelForm) or 'address' in cleaned_data or 'location' in cleaned_data:
        clean_loc(self, cleaned_data)

class DummyCategory(forms.Form):
    cat = forms.ChoiceField(label='', choices=CATEGORY)

class BaseForm(forms.ModelForm):
    address = forms.CharField(required=False, max_length=130, widget=forms.TextInput({
       'ng-change': 'geocode(true)',
       'ng-model-options': '{updateOn: \'default blur\', debounce: {default: 1000, blur: 0}}'
    }))
    location = forms.RegexField(r'^-?[\d]+(\.[\d]+)?(,|,? )-?[\d]+(\.?[\d]+)?$', label="Longitude/latitude")

    class Meta:
        fields = ('phone', 'supported_curr', 'address', 'location', 'opened', 'closed', 'opened_sat', 'closed_sat', 'opened_sun', 'closed_sun')
        model = Business
        widgets = {'phone': PhoneNumberInternationalFallbackWidget, 'supported_curr': forms.SelectMultiple}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        not_b = not isinstance(self, BusinessForm)
        if not_b:
            self.fields['phone'].widget.attrs['ng-model'] = 'data.form[1]'
            self.fields['supported_curr'].widget.attrs['ng-model'] = 'data.form[2]'
        else:
            self.fields['location'].widget.attrs['ng-initial'] = ''
        self.fields['phone'].widget.attrs['title'] = ''
        self.fields['address'].widget.attrs['ng-model'] = 'data.form[3]' if not_b else 'address'
        self.fields['location'].widget.attrs['geom_type'] = ''
        self.fields['location'].widget.attrs['ng-model'] = 'data.form[4]' if not_b else 'location'
        self.fields['location'].widget.attrs['readonly'] = True
        self.fields['location'].widget.attrs['title'] = ''
        self.fields['location'].help_text = "You have to adjust the exact location using the map with a marker below."
        for i, f in enumerate(['opened', 'closed', 'opened_sat', 'closed_sat', 'opened_sun', 'closed_sun']):
            self.fields[f].widget.attrs['value'] = ''
            self.fields[f].widget.attrs['ng-model'] = ('data.form[0]' if not_b else 'date')+'['+str(i)+']'
            if not not_b:
                self.fields[f].widget.attrs['ng-initial'] = i
            self.fields[f].widget.attrs['datetime'] = 'HH:mm'
            self.fields[f].widget.format = '%H:%M'
            if i > 1:
                if i % 2 == 0:
                    self.fields[f].label = "Opening time"
                else:
                    self.fields[f].label = "Closing time"

class BusinessForm(BaseForm):
    class Meta:
        fields = '__all__'
        model = Business
        widgets = {'phone': PhoneNumberInternationalFallbackWidget, 'supported_curr': forms.SelectMultiple}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['type'].label = "Type of your business"
        self.fields['name'].label = "Its name"
        self.fields['name'].widget.attrs['placeholder'] = "Name"
        self.fields['name'].widget.attrs['ng-model'] = 'name'
        self.fields['name'].widget.attrs['ng-initial'] = ''
        self.fields['name'].widget.attrs['ng-change'] = 'genshort()'
        self.fields['shortname'].label = "Shortname (a part of the URL)"
        self.fields['shortname'].widget.attrs['placeholder'] = "Shortname"
        self.fields['shortname'].widget.attrs['title'] = ''
        self.fields['shortname'].widget.attrs['ng-model'] = 'shortname'
        self.fields['shortname'].widget.attrs['ng-initial'] = ''
        self.fields['address'].widget.attrs['ng-initial'] = ''

    def clean(self):
        business_clean_data(self, super().clean())