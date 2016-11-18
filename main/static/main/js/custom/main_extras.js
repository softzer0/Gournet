app.requires.push('uiGmapgoogle-maps');
app
    .config(function(uiGmapGoogleMapApiProvider) {
        uiGmapGoogleMapApiProvider.configure({
            libraries: 'visualization'
        });
    });