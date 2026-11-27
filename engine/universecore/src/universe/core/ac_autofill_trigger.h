#ifndef UNIVERSE_CORE_AC_AUTOFILL_TRIGGER_H_
#define UNIVERSE_CORE_AC_AUTOFILL_TRIGGER_H_

namespace content {
class WebContents;
}

namespace universecore {

void TrackAutofillFocus(content::WebContents* contents);
bool ShowAutofillSuggestions(content::WebContents* contents, bool passwords);

}

#endif
