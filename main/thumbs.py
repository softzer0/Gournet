# -*- encoding: utf-8 -*-
"""
django-thumbs on-the-fly
https://github.com/madmw/django-thumbs

A fork of django-thumbs [http://code.google.com/p/django-thumbs/] by Antonio Melé [http://django.es].

"""
import io
from PIL import Image, ImageOps
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
#from django_thumbs.settings import THUMBS_GENERATE_THUMBNAILS

THUMB_SUFFIX = '%s.%sx%s.%s'

def generate_path(username, filename):
    return settings.IMAGES_PATH+'%s/%s' % (username, filename)


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


def generate_thumb(username, imgname, image, size, preserve_ratio):
    """Generates a thumbnail of `size`.
    :param image: An `File` object with the image in its original size.
    :param size: A tuple with the desired width and height. Example: (100, 100)
    """
    base, extension = imgname.rsplit('.', 1)
    thumb_name = THUMB_SUFFIX % (base, size[0], size[1], extension)
    thumbnail = save_img(image, preserve_ratio, extension, size)
    default_storage.save(generate_path(username, thumb_name), thumbnail)


def delete(username, imgname, sizes):
    if imgname and sizes:
        for size in sizes:
            base, extension = imgname.rsplit('.', 1)
            thumb_name = THUMB_SUFFIX % (base, size[0], size[1], extension)
            try:
                default_storage.delete(generate_path(username, thumb_name))
            except Exception:
                if settings.DEBUG:
                    raise


def saveimgwiththumbs(username, imgname, content, sizes, preserve_ratio=True):
    image = save_img(content, preserve_ratio, imgname.split(".")[-1])
    default_storage.save(generate_path(username, imgname), image)
    if sizes:
        for size in sizes:
            try:
                generate_thumb(username, imgname, content, size, preserve_ratio)
            except Exception:
                if settings.DEBUG:
                    raise