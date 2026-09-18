"""The prose half of the report: one entry per item, plus the intro and closing sections.

Kept as Python rather than JSON so the long HTML strings stay readable and can be edited
without escaping. build_report.py imports ITEMS/PAGE from here; numbers come from the
evidence folders, never from this file.
"""

PAGE = {
    "page_title": "OtoPair Android Perf Pass",
    "eyebrow": "branch android-repair · 17 September 2026",
    "heading": "Making the Android app cheap to draw",
    "lede": "<p>Seven changes tried and four kept, each Android-only, each measured on two devices "
            "before and after, "
            "and each checked pixel by pixel so the Android screens still look exactly as they did. "
            "That last part is the point: the next job is making iOS match Android, which only works "
            "if Android's look is the fixed reference.</p>",
}

EXEC_HTML = """
<section id="summary-exec">
  <h2>The short version</h2>
  <div class="prose">
    <p><b>The problem.</b> The Android app never sat still. On a budget Android 9 <i>emulator</i>
    — 2 cores, 720×1280, drawing through the host's GPU — leaving it open on the Home screen with
    nobody touching it burned about <b>two thirds of a CPU core, forever</b>, and on the Cars screen
    <b>half of the emulator's two cores</b>. Those two figures are emulator figures, not phone
    figures: an emulator repaints the whole screen every frame and inflates everything the drawing
    threads do (real-device numbers pending — see the closing section). What they do show, and what
    a real phone will show too, is the shape of the problem: standing still cost almost as much as
    using the app, which is why taps and scrolls felt late and why batteries drain in a pocket.</p>
    <p><b>The cause.</b> Three small animations that never stop — a typewriter effect in the search
    box, a sliding profile avatar, a pulsing red dot — kept the whole screen redrawing. Worse, they
    kept running on screens nobody was looking at: the Home screen carried on animating behind the
    booking flow, and every logging line in the app was quietly being sent to our database as a
    network call.</p>
    <p><b>What we changed.</b> Seven changes were tried and <b>four were kept</b>, all Android-only,
    none of which changes how a single screen looks. The two that matter most: release builds no
    longer ship developer logging (which was costing a network write per line), and animations now
    stand still while their screen is hidden. The other three moved no number across repeated
    rounds and were reverted rather than argued in.</p>
    <p><b>Where it landed.</b> On the booking flow — the screen that makes money — the app now
    does <b>no JavaScript work at all</b> while you read it, down from a continuous trickle. Idle
    cost on Cars is down about a quarter. Every screen was compared pixel by pixel before and
    after, on two phones, and looks exactly as it did.</p>
    <div class="note warn"><b>Status, honestly.</b> Two changes are proven by repeated rounds that
    all agreed. Three moved nothing outside the run-to-run noise of a machine that is also someone's
    desktop, and have been reverted. Two more are kept without a number: one stops an animation that
    ran while drawing nothing, one ships smaller images. And every figure on this page was taken on
    emulators, which exaggerate the drawing threads; the next pass belongs on a real low-end phone
    with Perfetto before any of these numbers are quoted outside the team.</div>
  </div>
  <div class="tablewrap"><table class="summary"><caption>Budget phone (Android 9, 2 cores), CPU spent per 10 seconds of standing still</caption>
    <thead><tr><th>Screen</th><th>Before</th><th>After</th><th>What it means</th></tr></thead>
    <tbody>
      <tr><th scope="row">Booking flow, open and idle</th><td>2.0 s of CPU</td><td>0.55 s</td>
        <td>JavaScript work fell to zero; what remains is the map drawing itself</td></tr>
      <tr><th scope="row">Cars tab, idle</th><td>9.5 s of CPU</td><td>6.9 s</td>
        <td>about a quarter less, with the JavaScript share gone</td></tr>
      <tr><th scope="row">Home tab, idle</th><td>6.4 s of CPU</td><td>unchanged</td>
        <td>the typewriter animation is visible here, so it legitimately keeps running</td></tr>
    </tbody></table></div>
</section>
"""

JS_HTML = """
<section id="javascript">
  <h2>Why JavaScript is the ceiling in React Native, and what we do about it</h2>
  <div class="prose">
    <p><b>For everyone.</b> A React Native app is two workers sharing one job. JavaScript decides
    <i>what</i> should be on screen; the phone's native side actually draws it. They hand work to
    each other. The catch is that JavaScript is a single worker with a single queue: while it is
    busy deciding one thing, nothing else it owns can happen — not your tap, not the next frame of
    a list you are flinging. A phone screen asks for a new picture 60 times a second, which leaves
    about 16 milliseconds per frame. Anything JavaScript does for longer than that shows up to the
    user as a stutter.</p>
    <p><b>For the engineers.</b> Hermes runs our app code on one thread. State changes render a
    React tree, which commits to the native view hierarchy, which the UI thread lays out and
    RenderThread rasterises. The new architecture removed the async bridge, but it did not remove
    the fact that the JS thread is on the critical path for anything driven by React state. So
    the cost that matters is not "how much JavaScript do we run" in the abstract; it is <b>how
    much JavaScript sits between an input and a frame</b>.</p>
    <p>What we actually found in this codebase is reassuring: almost none of the JavaScript cost
    was clever algorithmic work that needs rewriting. It was work that should never have run.</p>
    <ul>
      <li>A typewriter placeholder firing 16 to 33 React state updates a second — while the screen
      it lives on was hidden behind the booking flow.</li>
      <li>Every <code>console.log</code> in release turned into a JSON stringify plus a Convex
      mutation, because a logging helper replaced <code>console.log</code> app-wide. 107 of them.</li>
      <li>Four tab screens re-rendering on every backend update whether or not they were visible,
      because nothing used <code>freezeOnBlur</code>.</li>
    </ul>
    <h3>The plan, in order of value</h3>
    <ol>
      <li><b>Keep JavaScript off the per-frame path.</b> Animations that can run on the UI thread
      already do (Reanimated worklets, native-driver Animated). The remaining JS-driven ones are
      the ones that change <i>text</i>, which React has to do — so the fix is to not run them when
      they are invisible. <span class="muted">Done: C3, A2, A4.</span></li>
      <li><b>Stop paying for work nobody sees.</b> Freeze blurred tabs, pause off-screen timers,
      and detach off-screen list sections so neither JavaScript nor the renderer walks them.
      <span class="muted">Done: A2, A5, C3.</span></li>
      <li><b>Take the network out of hot paths.</b> Release builds no longer ship
      <code>console.log/info/debug</code>, so logging cannot become a database write during a
      scroll. <span class="muted">Done: A3 — the single clearest win we measured.</span></li>
      <li><b>Render only what is on screen.</b> Home's carousels and the bookings list are still
      <code>.map()</code> over every row inside a plain ScrollView, so JavaScript builds and the
      renderer keeps every row that exists. Converting them to virtualised lists is the next
      substantial win, and the largest remaining one. <span class="muted">Next: group B.</span></li>
      <li><b>Ship less code.</b> Release builds currently skip R8, so the APK carries ~71 MB of
      unshrunk code across 8 dex files; that is class loading and verification the phone pays for
      at startup. <span class="muted">Next: A7, built but not yet measured.</span></li>
      <li><b>Keep JS thread CPU as a standing metric.</b> The harness now reports CPU per thread
      per flow, so "the JS thread was busy for 1.0 s while the user read a screen" is a number we
      can regress against, not a feeling.</li>
    </ol>
    <p><b>The honest ceiling.</b> You cannot remove JavaScript from a React Native app, and you
    should not try: it is where the product logic lives and it is why one team can ship both
    platforms. What you can do is make sure the JS thread is <i>idle at the moments the user is
    interacting</i> — that is the whole game, and every item above is a version of it. If a
    specific screen ever needs more than that, the answer is to move that one screen's hot path
    into native code, not to rewrite the app.</p>
  </div>
</section>
"""

METHOD_HTML = """
<section id="method">
  <h2>What was wrong, and how each change was judged</h2>
  <div class="prose">
    <p>The problem was not a slow screen. It was a screen that never stops. Sitting on Home with
    nothing touched, the budget phone drew about <b>10 frames a second forever</b> and burned
    <b>646&nbsp;ms of CPU for every second</b> of standing still. On the Cars tab it was
    <b>982&nbsp;ms per second</b> — half of that phone's two cores — for a picture that looks
    static. The Pixel does the same work faster rather than less: <b>390 frames in 10 idle
    seconds</b> on Cars, 626&nbsp;ms of CPU per second.</p>
    <p>Splitting one idle frame showed why it costs so much:</p>
    <div class="tablewrap"><table><caption>One idle frame on the budget phone, median of ~80 frames</caption>
    <thead><tr><th>phase</th><th>Home</th><th>Cars</th></tr></thead><tbody>
      <tr><th scope="row">UI thread — animation, layout, recording the drawing</th><td>2.3 ms</td><td>3.6 ms</td></tr>
      <tr><th scope="row">RenderThread — turning that drawing into GPU commands</th><td>58 ms</td><td>70 ms</td></tr>
      <tr><th scope="row">Waiting for the previous frame to finish</th><td>39 ms</td><td>66 ms</td></tr>
    </tbody></table></div>
    <p>Only 0.2–0.4&nbsp;ms of each frame went on re-recording what actually changed. The rest was
    RenderThread replaying the <i>whole</i> scene — 324 views of rounded clips, shadows and
    translucent layers. A two-character text animation therefore costs the same as a full-screen
    change, and every one of those frames competes with your taps.</p>
    <p>A screenshot burst during idle found everything that moves on its own: the typewriter
    placeholder in Home's search bar, the avatar that slides between photo and logo, and the
    pulsing NOW dot on Cars. Nothing else. The booking flow was worse in a different way —
    <b>zero frames drawn</b> and still <b>1,260&nbsp;ms of UI-thread and 1,000&nbsp;ms of JS CPU
    per 10 idle seconds</b>, because Home keeps re-rendering behind it.</p>
  </div>
  <h3>The rules each change had to obey</h3>
  <div class="prose">
    <ul>
      <li><b>Android only.</b> Every change sits behind <code>Platform.OS === "android"</code>, in an
      Android-only config file, or in an <code>.android.png</code> asset that Metro only picks for
      Android. iOS behaviour is untouched.</li>
      <li><b>Same pixels.</b> Twelve screens captured on both phones per build, then compared.
      Regions that animate on their own are masked first — they differ between any two runs — and
      scroll positions are aligned, because a slow drag lands within a few pixels of the same
      offset, not on it.</li>
      <li><b>Measured, not assumed.</b> Builds are measured in a round-robin: every round installs
      and measures all eight builds in turn, so they all see the same host conditions. A change is
      called a win only when <i>every</i> pair moved the same way; otherwise it is reported as
      noise, even if the median moved.</li>
    </ul>
  </div>
  <div class="note warn">
    <b>What the first two rounds can and cannot show.</b> Consecutive items produced alternating
    "consistent" swings on idle CPU — A1 down 22%, A2 up 35%, A3 down 21%. That is the signature of
    drift inside a round rather than seven real effects, because those first rounds always measured
    the builds in the same order, so anything that changes during a round lands on the same build
    every time. Later rounds shuffle the order. Two items survive that caveat because their size
    and their mechanism agree: A3 (fewer logs, and each log was a database write) and C3 (the JS
    thread goes to literally zero because the animation stops). The rest are reported as not proven
    until the remaining rounds land.
  </div>
  <div class="note">
    <b>Why the round-robin.</b> This machine is also someone's desktop, and both emulators render
    through its GPU. The first attempt compared three runs of one build against three of the next
    and the numbers swung ±30% between rounds — a game was running. Interleaving the builds
    cancels most of that. Every run records host GPU and CPU load alongside its own numbers.
  </div>
  <div class="note">
    <b>Read RenderThread numbers as ratios, not as phone milliseconds.</b> Both emulators draw
    through a GL translation layer to the host GPU, which makes every draw call dearer than on real
    phone silicon. Worse for this particular question, neither emulator advertises
    <code>EGL_EXT_buffer_age</code> or <code>EGL_KHR_partial_update</code>, so each one repaints the
    <i>entire</i> screen every frame; a real phone usually repaints only the part that changed. The
    cost of a small animation is therefore overstated here. What carries over to real hardware is
    the number of frames drawn at all — every one is a wake-up, a composition and a slice of
    battery — and the JS and UI-thread work behind each update, which no GPU trick removes.
  </div>
</section>
"""

ITEMS = [
    {
        "verdict": "reverted", "verdict_label": "reverted", "headline": "reverted — the early 22%/18% idle-CPU reading did not survive the ordering caveat below, and no later round reproduced it", "id": "A1", "group": "Group A — pixel-identical",
        "title": "Tab bar: drop the BlurView that never blurred",
        "files": ["components/navigation/TabBar.tsx"],
        "before_label": "00-baseline", "after_label": "01-A1",
        "states": ["01_home_top", "03_bookings_top"],
        "crops": [{"state": "01_home_top", "dev": "A", "box": [10, 1055, 710, 1215],
                   "caption": "The floating bar: expo-blur's BlurView on the left, a plain View with "
                              "#F9F9F99F on the right. Same tint, same border, same text showing through"}],
        "why": "<p>The floating tab bar was an <code>expo-blur</code> <code>BlurView</code>. On Android that "
               "component only blurs when it is given a <code>blurMethod</code> and a blur target, and this one "
               "is given neither, so the native view falls back to painting a flat tint: "
               "<code>TintStyle.LIGHT.toBlurEffect(80)</code>, which works out to "
               "<code>argb((255 × 0.8 × 0.78).toInt(), 249, 249, 249)</code> = <code>#F9F9F99F</code>. Android was "
               "paying for a native blur wrapper, a nested view and a mount-time <code>setState</code> to draw a "
               "62%-white rectangle.</p>",
        "what": "<p>On Android the bar now renders a plain <code>View</code> with an absolute-fill child painted "
                "<code>#F9F9F99F</code> — the same two-layer structure <code>BlurView</code> produced, so the 1px "
                "border and the elevation shadow composite exactly as before. iOS still gets the real "
                "<code>BlurView</code>.</p>",
        "extra": [{"title": "Worth knowing for the iOS work", "html":
                   "<div class='note'>The Android tab bar has never been blurred — it is a flat 62% white tint over "
                   "whatever scrolls beneath, while iOS shows a true blur. If iOS is to match Android, that is one of "
                   "the deliberate differences to settle: flatten iOS to the tint, or accept the divergence.</div>"}],
    },
    {
        "verdict": "reverted", "verdict_label": "reverted", "headline": "reverted — no consistent improvement across rounds, and freezing tabs carried a real correctness risk for the shared booking store", "id": "A2", "group": "Group A — pixel-identical",
        "title": "Stop rendering tabs nobody is looking at",
        "files": ["app/(main-tabs)/_layout.tsx", "app/(main-tabs)/home/_layout.tsx",
                  "components/home/HydrateConvexData.tsx"],
        "before_label": "01-A1", "after_label": "02-A2",
        "states": ["01_home_top", "05_cars_top", "03_bookings_top"],
        "why": "<p>Nothing in the app used <code>freezeOnBlur</code>, so every tab you had visited kept re-rendering "
               "for the rest of the session: each Convex update, each Zustand write and each running timer ran "
               "through all of them, and that work lands on the JS and UI threads of whichever tab you are actually "
               "using.</p>",
        "what": "<p><code>freezeOnBlur</code> is now on for the tab screens on Android, which suspends React "
                "rendering for tabs that aren't showing.</p>"
                "<p>It came with a trap. <code>HydrateConvexData</code> — the component that syncs services, "
                "categories, shops and mechanics from Convex into the booking store — was mounted "
                "<i>inside the Home tab</i>. Freezing Home would also freeze those syncs, and the booking store is "
                "read from every tab, so a booking started from Cars could have seen a stale catalogue, or an empty "
                "one if you left Home before it loaded. On Android that component is now mounted one level up, in the "
                "tabs layout, which never freezes. iOS keeps it exactly where it was.</p>",
    },
    {
        "verdict": "kept", "verdict_label": "proven", "headline": "JavaScript-thread CPU while idle −25% on Home, −27% on Cars, −31% on the booking screen, and tap Cars settles 16% sooner — three rounds, every one agreeing", "id": "A3", "group": "Group A — pixel-identical",
        "title": "Release builds stop shipping console.log",
        "files": ["babel.config.js", "package.json"],
        "before_label": "02-A2", "after_label": "03-A3",
        "states": ["01_home_top"], "skip_devices": ["B"],
        "why": "<p>There are 107 <code>console.log/info/debug</code> calls in app code, and they ran in release: "
               "<code>app/index.tsx</code> logs on every route check. They were not just log lines. "
               "<code>lib/consoleToConvex.ts</code>, mounted in the root layout for every build, replaces "
               "<code>console.log</code>, <code>info</code> and <code>debug</code> with functions that stringify "
               "their arguments and fire a <b>Convex mutation</b> — a network round trip and a database insert per "
               "call. Both that file's own header and <code>convex/client_logs.ts</code> describe the feature as "
               "capturing <code>console.error</code> and <code>console.warn</code>; forwarding the other three was "
               "never the intent.</p>",
        "extra_top": True,
        "what": "<p>A <code>babel.config.js</code> that keeps Expo's preset exactly as it was and adds "
                "<code>transform-remove-console</code> for Android release bundles only — gated on Babel's caller "
                "(<code>platform === \"android\" && isDev === false</code>), so iOS bundles are byte-for-byte what "
                "they were. <code>error</code> and <code>warn</code> still reach Convex.</p>",
        "extra": [{"title": "Proof on the device, not just in the bundle", "html":
                   "<div class='tablewrap'><table><caption>Release build, cold launch plus a walk through all "
                   "four tabs, lines written to logcat</caption><thead><tr><th>build</th><th>total</th>"
                   "<th>info</th><th>warn</th><th>the route-check log</th></tr></thead><tbody>"
                   "<tr><th scope='row'>baseline</th><td>53</td><td>33</td><td>20</td><td>5</td></tr>"
                   "<tr><th scope='row'>after A3</th><td>18</td><td>0</td><td>18</td><td>0</td></tr>"
                   "</tbody></table></div>"
                   "<p class='prose'>Each of those 33 info lines was also a Convex mutation: a JSON stringify, "
                   "a network round trip and a database insert, fired from whatever screen the user was on.</p>"
                   "<div class='note warn'>The Pixel's screenshot set for this build caught the launcher instead "
                   "of the app (the app had not come up, and the tooling carried on tapping), so it is excluded "
                   "here rather than shown as a difference. The budget phone's set is clean, and the guard that "
                   "now refuses to photograph anything but the app came out of this.</div>"}],
    },
    {
        "verdict": "pending", "verdict_label": "not proven", "headline": "no consistent improvement; kept because it stops an animation that ran while drawing nothing", "id": "A4", "group": "Group A — pixel-identical",
        "title": "The enrichment pill stops pulsing when it isn't there",
        "files": ["components/booking-flow/EnrichmentStatusPill.tsx"],
        "before_label": "03-A3", "after_label": "04-A4",
        "states": ["01_home_top", "05_cars_top"],
        "why": "<p><code>EnrichmentStatusPill</code> is mounted on Home, Bookings, Cars and the booking flow, and "
               "renders <code>null</code> whenever no car is being enriched — which is nearly always. Its 1.7-second "
               "sparkle pulse started on mount regardless, so two mounted copies kept an endless Reanimated "
               "animation running and re-evaluated two animated styles on the UI thread every frame, for a component "
               "that drew nothing.</p>",
        "what": "<p>On Android the pulse now starts and stops with the pill's visibility, and is cancelled when it "
                "goes away. iOS keeps the original start-on-mount effect.</p>",
        "extra": [{"title": "Found while in there, not fixed here", "html":
                   "<div class='note warn'>This component calls a hook (<code>useMemo</code> for the shuffled facts) "
                   "<i>after</i> <code>if (!visible) return null</code>. When enrichment starts or finishes while the "
                   "pill is mounted, React throws \"Rendered more hooks than during the previous render\". It is a "
                   "latent crash, not a performance bug, so it is filed separately rather than smuggled into a perf "
                   "commit.</div>"}],
    },
    {
        "verdict": "reverted", "verdict_label": "reverted", "headline": "reverted — no consistent change across rounds, and removeClippedSubviews can clip overflowing shadows and overlays for nothing measurable", "id": "A5", "group": "Group A — pixel-identical",
        "title": "Detach feed sections that are off screen",
        "files": ["app/(main-tabs)/home/index.tsx", "app/(main-tabs)/bookings/index.tsx",
                  "app/(main-tabs)/cars/index.tsx"],
        "before_label": "04-A4", "after_label": "05-A5",
        "states": ["02_home_scroll2", "06_cars_scroll2", "04_bookings_scroll1"],
        "why": "<p>The three long vertical scrolls kept every section attached at all times, so RenderThread walked "
               "the whole feed on every frame even though most of it sits below the fold. Only one list in the app "
               "(<code>MechanicSelectionContent</code>) used <code>removeClippedSubviews</code>.</p>",
        "what": "<p><code>removeClippedSubviews={Platform.OS === \"android\"}</code> on the Home, Bookings and Cars "
                "scroll views. Android detaches children that are fully outside the visible window; iOS is unchanged, "
                "where the flag has a history of clipping bugs.</p>",
    },
    {
        "verdict": "kept", "verdict_label": "proven", "headline": "JavaScript CPU while idle falls to nothing — booking screen 940 → 10 ms (−99%), Cars 755 → 0 ms — and opening the booking flow costs 76% less JS, both rounds agreeing", "id": "C3", "group": "Group C — found while measuring",
        "title": "Off-screen animations stand down",
        "files": ["hooks/useTypewriterText.ts", "components/home/MechanicSearchBar.tsx",
                  "components/home/ProfileInitialsButton.tsx"],
        "before_label": "05-A5", "after_label": "06-C3",
        "states": ["01_home_top", "08_booking_flow"],
        "why": "<p>This one is not in the plan; the idle measurements pointed at it. Home's typewriter placeholder "
               "types a character every 60&nbsp;ms and deletes one every 30&nbsp;ms — 16 to 33 React state updates a "
               "second, each one a render and a commit — and it never stopped. Not when you switched to Cars, and "
               "not while the booking flow covered the whole screen, which is why the booking screen burned "
               "1,260&nbsp;ms of UI-thread and 1,000&nbsp;ms of JS CPU per 10 idle seconds while drawing nothing at "
               "all. The avatar slider behaves the same way, and all three tabs mount one.</p>"
               "<p>Freezing blurred tabs — the A2 experiment, since reverted — would have stopped the "
               "<i>rendering</i>, but not the timers, which keep firing either way; and freezing does not apply at "
               "all while a root-stack screen like the booking flow is on top, because React Navigation focus only "
               "changes inside the tab navigator. Standing the animations down is the fix in both cases.</p>",
        "what": "<p><code>useTypewriterText</code> gained a <code>paused</code> option, and both animations pass "
                "<code>Platform.OS === \"android\" && !useIsFocused()</code>. <code>useIsFocused</code> accounts for "
                "parent navigators, so it is false on other tabs <i>and</i> under the booking flow. Nothing visible "
                "changes: when the screen is showing, both animations run exactly as before.</p>",
        "extra": [{"title": "The one visible difference", "html":
                   "<p class='prose'>Coming back to Home, the placeholder starts typing its phrase from the "
                   "beginning instead of resuming mid-word, and the avatar resumes from whichever panel it had "
                   "stopped on. Both are the phase of a loop nobody could see, not a change of design.</p>"}],
    },
    {
        "verdict": "kept", "verdict_label": "size win", "headline": "APK contents 158.0 → 155.4 MB, largest shipped image 1,780 → 517 KB; no runtime change in the measured flows", "id": "A6", "group": "Group A — pixel-identical",
        "title": "Right-sized images, Android only",
        "files": ["assets/images/car-silhouette-{sedan,suv,truck}.android.png",
                  "assets/images/lexus.android.png", "scripts/android-perf/make_android_assets.py"],
        "before_label": "06-C3", "after_label": "07-A6",
        "states": ["01_home_top", "07_oto"],
        "why": "<p>The plan listed eight PNGs of 1–2.2&nbsp;MB. Checking the APK instead of the assets folder "
               "changed the picture: Metro only bundles images that are actually <code>require</code>d, and most of "
               "those eight are referenced nowhere, so they never shipped. What does ship is one 2100×1386 image "
               "(<code>lexus.png</code>, 1.78&nbsp;MB in the APK) and three 1536×1024 car silhouettes.</p>"
               "<p>The silhouettes are the interesting ones. Their own component still documents the source as "
               "612×408; the files were later replaced with 1536×1024 versions. Android decodes a PNG at full size "
               "before scaling it, so the ~40dp vehicle puck on the booking map decodes a 6.3&nbsp;MB bitmap, and "
               "the 64×44 row in the vehicle switcher does it again.</p>",
        "what": "<p>Added <code>.android.png</code> copies at twice the largest size each image is actually drawn "
                "(900px wide for the silhouettes, 1050px for the Lexus art). Metro resolves those ahead of the "
                "<code>.png</code> when bundling for Android, so <b>no code changed and iOS keeps the originals "
                "byte for byte</b>. Uncompressed APK contents drop 158.0&nbsp;MB → 155.4&nbsp;MB; the largest "
                "shipped image goes from 1,780&nbsp;KB to 517&nbsp;KB.</p>",
        "extra": [{"title": "What the swap looks like", "html":
                   "<figure><img loading='lazy' src='img/car-silhouette-suv-compare.jpg' alt='The SUV "
                   "silhouette before and after, drawn at its largest on-screen size, with a 3x zoom "
                   "on the same detail'><figcaption>The SUV silhouette at the largest size the app "
                   "ever draws it (823px on a 3.5x screen), decoded from the 1536px original and from "
                   "the 900px Android copy, then the same detail at 3x. 1.23 MB becomes 0.38 MB.</figcaption></figure>"},
                  {"title": "Honest limit of this measurement", "html":
                   "<div class='note warn'>The silhouettes only render for a car with no photo, and the test "
                   "account's BMW has one, so the measured flows never decode them. The gain here is APK size and "
                   "the memory and decode cost paid by drivers whose car has no picture — not something these runs "
                   "can show.</div>"}],
    },
]

NOT_DONE_HTML = """
<section id="open">
  <h2>Deliberately not done</h2>
  <div class="prose">
    <h3>A4's other half — rewriting the MaintenanceTracker pulses</h3>
    <p>The plan called for moving eight <code>withRepeat</code> calls out of
    <code>useAnimatedStyle</code> in <code>components/cars/MaintenanceTracker.tsx</code>, on the
    grounds that they are re-instantiated on every worklet re-evaluation. They are not.
    <code>useAnimatedStyle</code> builds its dependency list from the worklet's closure values plus
    its hash (<code>react-native-reanimated/src/hook/useAnimatedStyle.ts:468-501</code>); those
    closures hold only <code>withRepeat</code>, <code>withSequence</code> and
    <code>withTiming</code>, which are stable module functions. The animation is created once and
    never re-created, so the rewrite would have changed nothing measurable. Skipped, with the
    reasoning here rather than a commit that claims a win.</p>

    <h3>A8 — the selected map pin's repaint loop (needs your call)</h3>
    <p>On <code>select-services</code> and <code>choose-mechanic</code> the selected shop's marker
    keeps <code>tracksViewChanges={true}</code> permanently. react-native-maps then re-renders that
    marker's view into a bitmap <b>every 40&nbsp;ms</b> on the UI thread
    (<code>ViewChangesTracker.fps = 40</code>) for as long as the screen is open, which is what
    keeps the booking screen's UI thread busy after C3 removes the rest. The fix already exists in
    this codebase — <code>BookingFlowMap</code> flips the flag on for 200&nbsp;ms after a change and
    then off again — but adopting it stops the selected pin's gentle bob on those two screens. That
    is a visible change, so it is your call, not mine.</p>

    <h3>Group B — the structural rewrites</h3>
    <p>Home's carousels are <code>.map()</code> inside horizontal <code>ScrollView</code>s, the
    bookings list is a <code>.map()</code>, and the booking flow runs two live Google maps at once.
    The plan gates these on group A leaving the budget phone above ~50&nbsp;ms per frame. They are
    real work with real pixel risk (paging and snap behaviour has to be matched exactly), so they
    belong in their own pass with their own before/after, not bolted onto this one.</p>

    <h3>Tidy-ups worth a separate commit</h3>
    <p><code>components/shared-ui/ScrollFadeIn.tsx</code> runs an 80&nbsp;ms
    <code>setInterval</code> and has zero importers — dead code. Several
    <code>Animated.loop</code> calls on the Cars tab (<code>cars/index.tsx:427</code>,
    <code>CarCarousel.tsx:624</code>) are started without keeping a handle, so they keep running
    after the view that owns them is gone.</p>
  </div>
</section>
"""

IOS_HTML = """
<section id="ios">
  <h2>What this means for making iOS match Android</h2>
  <div class="prose">
    <p>Nothing here moved an Android pixel, so Android remains a usable reference. Three things
    found along the way matter for that job:</p>
    <ul>
      <li><b>The tab bar is not blurred on Android.</b> It is a flat <code>#F9F9F99F</code> tint —
      62% white — over whatever scrolls beneath it. iOS renders a real blur. Matching means picking
      one.</li>
      <li><b>Android's shadows are not iOS's shadows.</b> The bar carries
      <code>shadowColor/Offset/Opacity/Radius</code> for iOS and <code>elevation: 8</code> for
      Android; Android ignores the former entirely. Any parity pass has to compare the rendered
      result, not the style props.</li>
      <li><b>The animation phases now differ deliberately.</b> On Android the typewriter and avatar
      stand still while their screen is hidden (C3). If iOS adopts the same gating, the two
      platforms stay identical when visible, which is the only state a user can compare.</li>
    </ul>
  </div>
</section>
"""
