from django.db import models
from django.contrib.auth.models import User as BaseUser

CHOICE_GENDER = (('1', 'Male'), ('2', 'Female'))


class Location(models.Model):
    city = models.CharField(max_length=75)
    country = models.CharField(max_length=25)

    def __unicode__(self):
        return ', '.join([self.city, self.state])


class Users(BaseUser):
    user = models.OneToOneField(BaseUser, on_delete=models.CASCADE)
    gender = models.IntegerField(choices=CHOICE_GENDER)
    birth = models.DateField()
    location = models.ForeignKey(Location)

    class Meta:
        ordering = ('user',)