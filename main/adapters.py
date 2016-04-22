from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.utils import valid_email_or_none


class AccountAdapter(DefaultAccountAdapter):
    def save_user(self, request, user, form, commit=True):
        data = form.cleaned_data
        user.username = data['username']
        user.email = data['email']
        user.first_name = data['first_name']
        user.last_name = data['last_name']
        user.gender = data['gender']
        user.birth_date = data['birth_date']
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
        user = super(SocialAccountAdapter, self).populate_user(request, sociallogin, data)
        #user.gender = sociallogin.account.extra_data['gender']
        print(sociallogin.account.extra_data)
        #google: {'locale': 'sr', 'email': 'mihailosoft@gmail.com', 'name': 'Miki Pop', 'id': '115870460243092480285', 'family_name': 'Pop', 'link': 'https://plus.google.com/115870460243092480285', 'given_name': 'Miki', 'gender': 'male', 'verified_email': True, 'picture': 'https://lh6.googleusercontent.com/-5jq6sO3I4nc/AAAAAAAAAAI/AAAAAAAAAG4/DdyjqIcm3C0/photo.jpg'}
        #fb: {'verified': True, 'id': '1150617648323168', 'timezone': 2, 'updated_time': '2016-04-11T19:33:12+0000', 'first_name': 'Mihailo', 'name': 'Mihailo Popovic', 'last_name': 'Popovic', 'email': 'mikisoft0@gmail.com', 'gender': 'male', 'locale': 'sr_RS', 'link': 'https://www.facebook.com/app_scoped_user_id/1150617648323168/'}
        return user
