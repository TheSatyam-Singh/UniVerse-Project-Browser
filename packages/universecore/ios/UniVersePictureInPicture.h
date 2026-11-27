#pragma once

#import <AppKit/AppKit.h>

@class UniVerseWebView;

namespace universe_pip {

void WatchZoom();

void VideoEntered(UniVerseWebView *view, NSString *host);

void DocumentEntered(UniVerseWebView *view);

void TabRequestedActivation(UniVerseWebView *view);

}
