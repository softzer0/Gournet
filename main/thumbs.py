# -*- encoding: utf-8 -*-
"""
django-thumbs on-the-fly
https://github.com/madmw/django-thumbs

A fork of django-thumbs [http://code.google.com/p/django-thumbs/] by Antonio Melé [http://django.es].

"""
import io
from PIL import Image, ImageOps
from django.core.files.base import ContentFile
from django.conf import settings
import os
from glob import glob
#from django_thumbs.settings import THUMBS_GENERATE_THUMBNAILS

THUMB_SUFFIX = '%s.%sx%s.%s'
FILENAME = 'avatar'

def save_img(image, preserve_ratio=True, image_format='JPEG', size=None):
    """Generates a thumbnail image and returns a ContentFile object with the thumbnail

    :param original: The image being resized as `File`.
    :param size: Desired thumbnail size as `tuple`. Example: (70, 100)
    :param preserve_ratio: True if the thumbnail is to keep the aspect ratio of the full image
    :param image_format: Format of the original image ('JPEG', 'PNG', ...) The thumbnail will be generated using this same image_format.
    :returns: ContentFile object with the thumbnail
    """
    if not isinstance(image, Image.Image):
        #if isinstance(original, ContentFile):
        image.seek(0) # see http://code.djangoproject.com/ticket/8222 for details
        image = Image.open(image)
    if image.mode not in ['L', 'RGB', 'RGBA']:
        if image.mode == 'P':
            image = image.convert('RGBA')
        else:
            image = image.convert('RGB')
    if size:
        if not preserve_ratio:
            image.thumbnail(size, Image.ANTIALIAS)
        else:
            image = ImageOps.fit(image, size, Image.ANTIALIAS)
    zo = io.BytesIO()
    image.save(zo, image_format)
    return ContentFile(zo.getvalue())

def save(type, pk, filename, image):
    path = settings.MEDIA_ROOT+'images/'+type+'/'+str(pk)+'/'
    try:
        os.makedirs(path)
    except:
        for f in glob(path+'*.'+('jpg' if filename.split('.')[-1] == 'png' else 'png')):
            os.remove(f)
    path += filename
    fout = open(path, 'wb+')
    for chunk in image.chunks():
        fout.write(chunk)
    fout.close()

def generate_thumb(type, pk, format, ext, image, size, preserve_ratio):
    """Generates a thumbnail of `size`.
    :param image: An `File` object with the image in its original size.
    :param size: A tuple with the desired width and height. Example: (100, 100)
    """
    #base, ext = filename.rsplit('.', 1)
    thumb_name = THUMB_SUFFIX % (FILENAME, size[0], size[1], ext)
    thumbnail = save_img(image, preserve_ratio, format, size)
    save(type, pk, thumb_name, thumbnail)

def saveimgwiththumbs(type, pk, format, content, thumb_preserve_ratio=True):
    if type in ['user', 'business', 0]:
        if type == 0:
            size = None
            type = 'user'
        else:
            size = (128,128)
        sizes = [(32,32), (48,48), (64,64)]
    else:
        size = (256,256)
        sizes = [(32,32), (64,64)]
    if format.lower() == 'jpeg':
        ext = 'jpg'
    else:
        ext = 'png'
    save(type, pk, FILENAME+'.'+ext, save_img(content, image_format=format, size=size))
    for size in sizes:
        try:
            generate_thumb(type, pk, format, ext, content, size, thumb_preserve_ratio)
        except Exception:
            if settings.DEBUG:
                raise