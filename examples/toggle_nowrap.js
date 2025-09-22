class ToggleLineWrap {
    async invoke() {
        app.customCss.setCssEnabledStatus('nowrap',!app.customCss.enabledSnippets.has('nowrap'));
    }
}
