from django.contrib.auth.forms import UserCreationForm
from allauth.socialaccount.forms import SignupForm as DefaultSocialSignupForm
from allauth.account.forms import SignupForm as DefaultSignupForm, LoginForm as DefaultLoginForm
from django import forms
from django.forms import extras
from django.contrib.auth import get_user_model
from .forms import clean_loc, CaptchaForm
from django.utils.translation import ugettext as _, get_language

User = get_user_model()

BIRTHDATE_YEARS = ('2003','2002',
                    '2001','2000','1999','1998','1997','1996','1995','1994','1993','1992','1991','1990','1989','1988',
                    '1987','1986','1985','1984','1983','1982','1981','1980','1979','1978','1977','1976','1975','1974',
                    '1973','1972','1971','1970','1969','1968','1967','1966','1965','1964','1963','1962','1961','1960',
                    '1959','1958','1957','1956','1955','1954','1953','1952','1951','1950','1949','1948','1947','1946',
                    '1945','1944','1943','1942','1941','1940','1939','1938','1937','1936','1935','1934','1933','1932',
                    '1931','1930','1929','1928','1927')
#CURRENCY_COUNTRY = (['RS', 'RSD'],)

class BaseSignupForm(UserCreationForm):
    birthdate = forms.DateField(widget=extras.SelectDateWidget(years=BIRTHDATE_YEARS))
    location = forms.CharField(required=False, widget=forms.HiddenInput())

    class Meta:
        model = User
        fields = ('username', 'email', 'password1', 'password2', 'first_name', 'last_name', 'gender', 'birthdate', 'address', 'location', 'currency', 'language')
        widgets = {'currency': forms.HiddenInput, 'language': forms.HiddenInput}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for f in ('username', 'birthdate'):
            self.fields[f].label = User._meta.get_field(f).verbose_name.capitalize()
        self.fields['username'].help_text = User._meta.get_field('username').help_text
        self.fields['password2'].help_text = _("Enter the same password as before, for verification.")
        for f in ('username', 'password2'):
            self.fields[f].widget.attrs['title'] = ''
        self.fields['username'].widget.attrs['placeholder'] = self.fields['username'].label
        self.fields['email'].widget.attrs['placeholder'] = User._meta.get_field('email').verbose_name.capitalize()
        self.fields['address'].widget.attrs['required'] = ''
        self.fields['address'].label = _("City")
        self.fields['address'].help_text = _("Enter city from where are you from, e.g: Vranje, Serbia.")

    def clean(self):
        cleaned_data = super().clean()
        if cleaned_data['birthdate'].year > 2003 or cleaned_data['birthdate'].year < 1927:
            self.add_error('birthdate', forms.ValidationError(_("Invalid birthdate."), code='invalid'))
        resp = clean_loc(self, cleaned_data, True, True)
        if self.errors:
            return
        cleaned_data['language'] = get_language()
        if resp:
            for a in reversed(resp['address_components']):
                if 'country' in a['types'] and a['short_name'] == 'RS': #for c in CURRENCY_COUNTRY:
                    cleaned_data['currency'] = 'RSD' #if a['short_name'] in c:
                    break #= c[1]

class SignupForm(BaseSignupForm, DefaultSignupForm, CaptchaForm):
    pass

class SocialSignupForm(DefaultSocialSignupForm, BaseSignupForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        sociallogin = kwargs.pop('sociallogin')
        if 'email' in sociallogin.account.extra_data:
            self.fields['email'].widget.attrs['readonly'] = True

class LoginForm(DefaultLoginForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['login'].label = User._meta.get_field('username').verbose_name.capitalize()
        self.fields['login'].widget.attrs['placeholder'] = self.fields['login'].label
        self.fields['remember'].label = _("Remember Me")