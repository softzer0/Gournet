from django import forms
from .models import CATEGORY

class DummyCategory(forms.Form):
    cat = forms.ChoiceField(label='', choices=CATEGORY)