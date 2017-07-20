from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
# from allauth.account.adapter import get_adapter
from datetime import datetime
from requests import get
from django.core.files.base import ContentFile
from .thumbs import saveimgwiththumbs


class AccountAdapter(DefaultAccountAdapter):
    def save_user(self, request, user, form, commit=True):
        data = form.cleaned_data
        user.username = data['username']
        user.email = data['email']
        user.first_name = data['first_name']
        user.last_name = data['last_name']
        user.gender = data['gender']
        user.birthdate = data['birthdate']
        user.city = data['city']
        user.country = data['country']
        if 'password1' in data:
            user.set_password(data['password1'])
        else:
            user.set_unusable_password()
        self.populate_username(request, user)
        if commit:
            user.save()
        return user


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    def populate_user(self,
                      request,
                      sociallogin,
                      data):
        user = super().populate_user(request, sociallogin, data)
        if 'gender' in sociallogin.account.extra_data:
            if sociallogin.account.extra_data['gender'] == 'male':
                user.gender = 0
            elif sociallogin.account.extra_data['gender'] == 'female':
                user.gender = 1
        if 'birthday' in sociallogin.account.extra_data:
            user.birthdate = datetime.strptime(sociallogin.account.extra_data['birthday'], "%m/%d/%Y")
        if 'location' in sociallogin.account.extra_data:
            user.address = sociallogin.account.extra_data['location']['name']
        #print(sociallogin.account.extra_data)
        #google: {'locale': 'sr', 'email': 'mihailosoft@gmail.com', 'name': 'Miki Pop', 'id': '115870460243092480285', 'family_name': 'Pop', 'link': 'https://plus.google.com/115870460243092480285', 'given_name': 'Miki', 'gender': 'male', 'verified_email': True, 'picture': 'https://lh6.googleusercontent.com/-5jq6sO3I4nc/AAAAAAAAAAI/AAAAAAAAAG4/DdyjqIcm3C0/photo.jpg'}
        #fb: {'verified': True, 'id': '1150617648323168', 'timezone': 2, 'updated_time': '2016-04-11T19:33:12+0000', 'first_name': 'Mihailo', 'name': 'Mihailo Popovic', 'last_name': 'Popovic', 'email': 'mikisoft0@gmail.com', 'gender': 'male', 'locale': 'sr_RS', 'link': 'https://www.facebook.com/app_scoped_user_id/1150617648323168/'}
        return user

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form)
        response = None
        if sociallogin.account.provider == 'facebook':
            response = get('https://graph.facebook.com/v2.9/'+sociallogin.account.extra_data['id']+'/picture?width=128&height=128')
        elif sociallogin.account.provider == 'google':
            response = get(sociallogin.account.extra_data['picture']+'?sz=128')
        if response and response.status_code == 200 and response.headers['content-type'] in ('image/jpeg', 'image/png', 'image/gif'):
            saveimgwiththumbs('user' if sociallogin.account.provider == 'facebook' else 0, user.pk, response.headers['content-type'][6:], ContentFile(response.content))
        return user