from os import environ
from sys import path
import django
path.append(abspath(join(dirname(__file__), '..')))
environ.setdefault('DJANGO_SETTINGS_MODULE', 'gournet.settings')
environ.setdefault('DEBUG', '1')
django.setup()
from main.models import Business, Card
from pyotp import HOTP
card = Card.objects.first()
print('Content-type: text/html\n\n')
print('<a href="{0}">{0}</a>'.format('https://test.gournet.co/%s/?t=%s&c=%s&p=%s' % (card.table.business.shortname, card.table.pk, card.pk, HOTP(card.table.business.table_secret).at(card.counter+1))))
