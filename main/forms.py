from django import forms
from .models import CATEGORY, Business
from phonenumber_field.widgets import PhoneNumberInternationalFallbackWidget
from geopy import GoogleV3
from django.contrib.gis.geos import fromstr, Point

GOOGLEV3_OBJ = GoogleV3() #api=

def clean_loc(self, cleaned_data, noloc=False, retraw=False):
    loc = cleaned_data.get('location', False) if not noloc else False
    try:
        if loc and not cleaned_data.get('address', False):
            cleaned_data['address'] = GOOGLEV3_OBJ.reverse(cleaned_data['location'])[0].address
        elif cleaned_data.get('address', False) and not loc:
            loc = GOOGLEV3_OBJ.geocode(cleaned_data['address'])
            cleaned_data['location'] = Point(loc.longitude, loc.latitude, srid=4326)
    except:
        loc = None
        pass
    if not loc:
        self.add_error('address' if 'username' in cleaned_data else 'location', forms.ValidationError("Either coordinates for specified address are not found, or there's some internal error.", code='required'))
    if retraw and loc:
        return loc.raw

class DummyCategory(forms.Form):
    cat = forms.ChoiceField(label='', choices=CATEGORY)

class BusinessForm(forms.ModelForm):
    address = forms.CharField(required=False, max_length=130, widget=forms.TextInput({
       'ng-model': 'address',
       'ng-initial': '',
       'ng-change': 'geocode(true)',
       'ng-model-options': '{updateOn: \'default blur\', debounce: {default: 1000, blur: 0}}'
    }))
    location = forms.RegexField(r'^-?[\d]+(\.[\d]+)?(,|,? )-?[\d]+(\.?[\d]+)?$', label="Longitude/latitude")

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
        self.fields['phone'].widget.attrs['title'] = ''
        self.fields['location'].widget.attrs['geom_type'] = ''
        self.fields['location'].widget.attrs['ng-model'] = 'location'
        self.fields['location'].widget.attrs['ng-initial'] = ''
        self.fields['location'].widget.attrs['readonly'] = True
        self.fields['location'].widget.attrs['title'] = ''
        self.fields['location'].help_text = "You have to adjust the exact location using the map with a marker below."
        for i, f in enumerate(['opened', 'closed', 'opened_sat', 'closed_sat', 'opened_sun', 'closed_sun']):
            self.fields[f].widget.attrs['value'] = ''
            self.fields[f].widget.attrs['ng-model'] = 'date['+str(i)+']'
            self.fields[f].widget.attrs['ng-initial'] = i
            self.fields[f].widget.attrs['datetime'] = 'HH:mm'
            self.fields[f].widget.format = '%H:%M'
            if i > 1:
                if i % 2 == 0:
                    self.fields[f].label = "Opening time"
                else:
                    self.fields[f].label = "Closing time"

    def clean(self):
        cleaned_data = super().clean()
        if cleaned_data.get('name', False):
            cleaned_data['name'] = cleaned_data['name'].replace('"', '\'')
        if cleaned_data.get('supported_curr', False) and cleaned_data.get('currency', False):
            try:
                cleaned_data['supported_curr'].remove(cleaned_data['currency'])
            except:
                pass
        if cleaned_data.get('shortname', False) and Business.objects.filter_by_natural_key(cleaned_data['shortname']).exists():
            self.add_error('shortname', forms.ValidationError("A business with that shortname already exists.", code='unique'))
        if cleaned_data.get('location', False):
            cleaned_data['location'] = fromstr('POINT('+cleaned_data['location'].replace(',', ' ')+')')
        clean_loc(self, cleaned_data)