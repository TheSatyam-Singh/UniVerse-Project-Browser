#ifndef UNIVERSE_CORE_AC_STRINGS_H_
#define UNIVERSE_CORE_AC_STRINGS_H_

#include <string>

#include "ui/base/resource/resource_bundle.h"

namespace universecore {

ui::ResourceBundle::Delegate* ProductStrings();

bool RenameProduct(std::u16string& text);

}

#endif
