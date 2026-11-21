"""Computes contrast ratios of text/icon colours against the glass-over-#070B12 backdrop used by the spec. Run: python3 contrast.py"""
def lin(c):
    c/=255
    return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
def L(rgb): return 0.2126*lin(rgb[0])+0.7152*lin(rgb[1])+0.0722*lin(rgb[2])
def hexrgb(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def over(fg,a,bg): return tuple(round(fg[i]*a+bg[i]*(1-a)) for i in range(3))
def ratio(a,b):
    la,lb=L(a),L(b); hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)
ground=hexrgb('#070B12'); white=(255,255,255)
bgs={'ground':ground,'glass 7%':over(white,.07,ground),'glass 9%':over(white,.09,ground),'glass 16% (selected seg)':over(white,.16,ground),'sheet 88%':over((16,22,33),.88,ground)}
fgs={'text #F2F5F9':'#F2F5F9','soft #C9D0DA':'#C9D0DA','muted #9AA4B2':'#9AA4B2','accent #5EEAD4':'#5EEAD4','alert #FF8A6B':'#FF8A6B'}
print('foreground over backdrop')
for bn,b in bgs.items():
    for fn,f in fgs.items():
        r=ratio(hexrgb(f.split()[-1]),b); print(f'{fn:16} on {bn:26} {r:5.2f}', 'OK' if r>=4.5 else ('large/icon only' if r>=3 else 'FAIL'))
print('on-colour text')
for n,fg,bg in [('onAccent on accent','#062A26','#5EEAD4'),('onAlert on alert','#2A0D04','#FF8A6B'),('onAccent on white','#062A26','#FFFFFF')]:
    print(f'{n:22} {ratio(hexrgb(fg),hexrgb(bg)):5.2f}')
# disabled: text 38% on white 7%
dis=over(hexrgb('#F2F5F9'),.38,over(white,.07,ground)); print('disabled text on disabled fill',round(ratio(dis,over(white,.07,ground)),2),'(exempt, WCAG inactive component)')
# chip outline white 22% on ground (non-text 3:1)
print('outline 22% on ground',round(ratio(over(white,.22,ground),ground),2),' 28%',round(ratio(over(white,.28,ground),ground),2))
print('dashed 16% divider',round(ratio(over(white,.16,ground),ground),2))
