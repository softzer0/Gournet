from django import forms
from .models import CATEGORY, Business
from phonenumber_field.widgets import PhoneNumberInternationalFallbackWidget
from django.contrib.gis.geos import fromstr

class DummyCategory(forms.Form):
    cat = forms.ChoiceField(label='', choices=CATEGORY)

class BusinessForm(forms.ModelForm):
    location = forms.RegexField(r'^-?[0-9]+(\.[0-9]+)?(,|,? )-?[0-9]+(\.?[0-9]+)?$', label="Longitude/latitude")

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
        self.fields['address'].widget.attrs['ng-model'] = 'address'
        self.fields['address'].widget.attrs['ng-initial'] = ''
        self.fields['address'].widget.attrs['ng-change'] = 'geocode(true)'
        self.fields['address'].widget.attrs['ng-model-options'] = '{updateOn: \'default blur\', debounce: {default: 1000, blur: 0}}'
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
        if 'name' in cleaned_data:
            cleaned_data['name'] = cleaned_data['name'].replace('"', '\'')
        if 'supported_curr' in cleaned_data and 'currency' in cleaned_data:
            try:
                cleaned_data['supported_curr'].remove(cleaned_data['currency'])
            except:
                pass
        if 'shortname' in cleaned_data and Business.objects.filter_by_natural_key(cleaned_data['shortname']).exists():
            self.add_error('shortname', forms.ValidationError("A business with that shortname already exists.", code='unique'))
        if 'location' in cleaned_data:
            cleaned_data['location'] = fromstr('POINT('+cleaned_data['location'].replace(', ', ' ').replace(',', ' ')+')')