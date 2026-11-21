"""Group 6: System. Lock cover, permission denied states, error and offline states, app icon, splash.
Requirements: SE-4, SE-8, IN-8, IN-9, LL-8, LL-12, UX-12, NF-3 (errors keep the form open)."""
from lib import *
from group2 import block

def centred(icon, title, text, actions, h=844, name=None, ttl=None, kind='accent'):
    ring = (f'<div aria-hidden="true" style="position: relative; width: 150px; height: 150px; border-radius: 999px; {GLASS_BLUR}; display: flex; align-items: center; justify-content: center">'
            f'<div style="position: absolute; inset: 14px; border-radius: 999px; border: 2px dashed rgba(255,255,255,0.16)"></div>{svg(IC[icon], 40, "#FF8A6B" if kind == "alert" else "@A@", 1.8)}</div>')
    body = (f'<div class="ax-r ax-d1" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; text-align: center; padding: 20px 10px 40px 10px">{ring}'
            f'<div style="display: flex; flex-direction: column; gap: 8px; max-width: 300px"><h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.6px">{title}</h1>{body_text(text, SOFT, 15)}</div>'
            f'<div style="display: flex; flex-direction: column; gap: 8px; align-items: center; width: 100%">{actions}</div></div>')
    put(name, ttl, content(gap=18) + body + '</div>', h=h)

def run():
    # ---- App lock cover (SE-8): hides everything, nothing of Today behind it
    centred('lock', 'Nettle is locked', 'Unlock with Face ID to continue. Nothing is shown until then.',
            btn('Unlock with Face ID', 'primary', 'lock', h=56) + btn('Use passcode', 'glass', h=52), name='G6-Lock.dc.html', ttl='App lock cover')
    centred('lock', 'Face ID did not work', 'Try again, or use your iPhone passcode.',
            btn('Try again', 'primary', 'lock', h=56) + btn('Use passcode', 'glass', h=52), name='G6-Lock-Failed.dc.html', ttl='App lock, Face ID failed', kind='alert')

    # ---- app switcher cover: only the logo, no content (SE-8)
    put('G6-Lock-Switcher.dc.html', 'App switcher cover',
        f'<div style="flex: 1; display: flex; align-items: center; justify-content: center"><div aria-hidden="true" style="width: 96px; height: 96px; border-radius: 999px; {GLASS_BLUR}; display: flex; align-items: center; justify-content: center">{svg(IC["lock"], 36, "@A@", 1.8)}</div></div>')

    # ---- permission denied: camera and photo library (IN-8, IN-9)
    centred('camera', 'Camera is off', 'Allow the camera for Nettle in the iPhone settings to scan a barcode or take a photo. You can still type or pick a photo from your library.',
            btn('Open iPhone settings', 'primary', 'sliders', h=56) + btn('Not now', 'glass', h=52), name='G6-CameraDenied.dc.html', ttl='Camera permission denied')
    centred('camera', 'Photos are off', 'Allow photo access for Nettle in the iPhone settings to pick photos. Photos you took with the app stay available.',
            btn('Open iPhone settings', 'primary', 'sliders', h=56) + btn('Not now', 'glass', h=52), name='G6-PhotosDenied.dc.html', ttl='Photo library permission denied')

    # ---- storage error keeps the form open (NF-3)
    err = banner('Not saved', 'The entry could not be stored on this phone. Your input is still here. Try again, and free some space if it keeps happening.', 'info', kind='alert')
    form('G6-StorageError.dc.html', 'Storage error, form stays open', 'Meal',
         f'<div class="ax-r ax-d1">{err}</div>' + f'<div class="ax-r ax-d2">{field("desc", "What did you eat?", "", "Chicken salad", "meal")}</div>' + f'<div class="ax-r ax-d3">{time_row()}</div>', 'Save meal')

    # ---- LLM errors (LL-8, LL-12)
    off = banner('No connection', 'The request did not go out. Nothing was sent and nothing was saved. Check the connection and try again.', 'info', kind='alert')
    pushed_float = lambda n, t, b, p: put(n, t, content(gap=18) + pushed_header('AI analysis', 'Review', 'Back to Review') + b + '</div>' + float_primary(p, 'sparkle', 'Opens the confirmation. Nothing is sent until you confirm.'), h=844)
    pushed_float('G6-LLM-Offline.dc.html', 'AI request, no connection', f'<div class="ax-r ax-d1">{off}</div>', 'Review and try again')
    lim = banner('Too many requests', 'Anthropic asked to wait. Try again in a minute. Nothing was saved.', 'info', kind='alert')
    pushed_float('G6-LLM-RateLimit.dc.html', 'AI request, rate limited', f'<div class="ax-r ax-d1">{lim}</div>', 'Review and try again')

    # ---- offline barcode lookup (IN-6)
    off2 = banner('Product lookup is offline', 'The barcode was read but the product database could not be reached. Type the name instead; the code is kept.', 'info', kind='alert')
    form('G6-BarcodeOffline.dc.html', 'Barcode lookup, offline', 'Log a meal',
         f'<div class="ax-r ax-d1">{off2}</div>' + f'<div class="ax-r ax-d2">{field("desc", "What did you eat?", "", None, "meal", True)}</div>', 'Save meal', missing='Describe the meal first')

    # ---- app icon and splash: ring on the aurora ground
    def ring_mark(size):
        s = size
        return (f'<svg width="{s}" height="{s}" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="34" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="6"/>'
                f'<circle cx="50" cy="50" r="34" fill="none" stroke="{{{{accent}}}}" stroke-width="6" stroke-linecap="round" stroke-dasharray="214" stroke-dashoffset="70" transform="rotate(-90 50 50)"/>'
                f'<circle cx="50" cy="16" r="5" fill="{{{{accent}}}}"/></svg>')
    def tile(size, r):
        return (f'<div role="img" aria-label="Nettle app icon, {size} pixels" style="width: {size}px; height: {size}px; border-radius: {r}px; background: radial-gradient(circle at 30% 20%, rgba(109,74,224,0.55), transparent 60%), radial-gradient(circle at 75% 80%, rgba(37,99,235,0.45), transparent 60%), #070B12; '
                f'box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center">{ring_mark(int(size * 0.62))}</div>')
    icon_body = (f'<div class="ax-r ax-d1" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px">{tile(180, 40)}'
                 f'<div style="display: flex; gap: 18px; align-items: flex-end">{tile(60, 14)}{tile(40, 9)}{tile(29, 7)}</div>'
                 f'{body_text("A ring that is filling, on the Aurora ground. No text and no letter, so it reads at every size.", MUTED, 13.5, "; text-align: center; max-width: 280px")}</div>')
    put('G6-AppIcon.dc.html', 'App icon', icon_body)
    put('G6-Splash.dc.html', 'Splash screen',
        f'<div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px">{ring_mark(120)}<span style="font-size: 34px; font-weight: 800; letter-spacing: -1px">Nettle</span></div>')

TITLE = 'Group 6: System'
NEEDS = '''Group 6: Needs approval

1. App lock cover shows only the lock, never any entry, and the app switcher cover shows only a lock mark. Affects SE-8.
2. A failed Face ID attempt reuses the lock cover with a coral icon and "Use passcode". Affects SE-8.
3. Camera and photo library denied: a full-screen explanation with "Open iPhone settings" and "Not now"; typing and the library stay available. Affects IN-8, IN-9.
4. Storage error and offline barcode lookup keep the form open with a coral banner and the input in place. Affects IN-6, NF-3.
5. App icon: an accent ring on the Aurora ground, no text; splash is the same ring and the word Nettle. Affects UX-1.
6. Rate limit gets its own message and a Try again button. Affects LL-8.'''
