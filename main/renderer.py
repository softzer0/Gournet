from bootstrap3.renderers import FieldRenderer as BaseRenderer

class FieldRenderer(BaseRenderer):
    def _render(self):
        if not self.field.field.required and self.field.name == 'address':
            self.add_widget_attrs()
            html = '<script type="text/ng-template" id="searchbox">'+self.field.as_widget(attrs=self.widget.attrs)+'</script>'
            self.restore_widget_attrs()
            #html = self.append_to_field(html)
            html = '<span id="sbparent"></span>'+html
            html = self.add_label(html)
            html = self.wrap_label_and_field(html)
            return html
        return super()._render()