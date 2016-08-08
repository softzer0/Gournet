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
#from django_thumbs.settings import THUMBS_GENERATE_THUMBNAILS

THUMB_SUFFIX = '%s.%sx%s.%s'


def gen_path(type, username_id):
    return settings.MEDIA_ROOT+'images/'+type+'/'+username_id+'/'


def save_img(original, preserve_ratio, image_format='JPEG', size=None):
    """Generates a thumbnail image and returns a ContentFile object with the thumbnail

    :param original: The image being resized as `File`.
    :param size: Desired thumbnail size as `tuple`. Example: (70, 100)
    :param preserve_ratio: True if the thumbnail is to keep the aspect ratio of the full image
    :param image_format: Format of the original image ('JPEG', 'PNG', ...) The thumbnail will be generated using this same image_format.
    :returns: ContentFile object with the thumbnail
    """
    original.seek(0)  # see http://code.djangoproject.com/ticket/8222 for details
    image = Image.open(original)
    if image.mode not in ('L', 'RGB', 'RGBA'):
        if image.mode == 'P':
            image = image.convert('RGBA')
        else:
            image = image.convert('RGB')
    if size:
        if preserve_ratio:
            image.thumbnail(size, Image.ANTIALIAS)
        else:
            image = ImageOps.fit(image, size, Image.ANTIALIAS)
    zo = io.BytesIO()
    if image_format.upper() == 'JPG':
        image_format = 'JPEG'
    image.save(zo, image_format)
    return ContentFile(zo.getvalue())


def save(type, username_id, filename, image):
    path = gen_path(type, username_id)
    try:
        os.makedirs(path)
    except:
        pass
    path += filename
    fout = open(path, 'wb+')
    for chunk in image.chunks():
        fout.write(chunk)
    fout.close()


def generate_thumb(type, username_id, imgname, image, size, preserve_ratio):
    """Generates a thumbnail of `size`.
    :param image: An `File` object with the image in its original size.
    :param size: A tuple with the desired width and height. Example: (100, 100)
    """
    base, extension = imgname.rsplit('.', 1)
    thumb_name = THUMB_SUFFIX % (base, size[0], size[1], extension)
    thumbnail = save_img(image, preserve_ratio, extension, size)
    save(type, username_id, thumb_name, thumbnail)


def saveimgwiththumbs(type, username_id, imgname, content, sizes, preserve_ratio=True):
    image = save_img(content, preserve_ratio, imgname.split('.')[-1])
    if type == 0:
        type = 'user'
    elif type == 1:
        type = 'business'
    elif type == 2:
        type = 'item'
    save(type, username_id, imgname, image)
    if sizes:
        for size in sizes:
            try:
                generate_thumb(type, username_id, imgname, content, size, preserve_ratio)
            except Exception:
                if settings.DEBUG:
                    raise