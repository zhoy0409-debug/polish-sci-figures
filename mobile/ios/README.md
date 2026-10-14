# Figure Studio · iOS local development preview

This is an iPhone/iPad **development wrapper**, not an App Store release or a device-installable IPA. It bundles the existing offline scientific engine and editor. It needs no server, API key, or peer computer at runtime. No Apple account is needed to compile and test the unsigned **simulator** app on macOS with Xcode.

The Python/WASM runtime, NumPy, SciPy, pandas, Matplotlib, Pillow and OpenCV are packaged inside the app. WKWebView loads these public assets from an in-process HTTP listener bound only to `127.0.0.1`. The listener accepts GET/HEAD for immutable bundled files and has no data-upload endpoint. Research calculations use local Web Worker messages. The 0.1.8 simulator build includes a narrow exception for an explicitly started Europe PMC literature search, sending chart terms and an optional typed topic, not research data. Other remote resources remain blocked; no external browser is opened automatically. Update checks fetch only public version metadata from the official GitHub repository; they send no research data. Local calculation remains available offline. The validation record identifies which simulator builds were checked.

The first OS-assigned loopback port is remembered. Subsequent launches require that same port so the IndexedDB origin, autosaves and undo history remain stable. An occupied port produces a retry message instead of silently starting with different project storage. WebKit and document storage are excluded from iCloud backup. Exporting a file to a cloud provider is still possible **only when the user selects that destination in the system Files dialog**.

## Build and test

Prepare `.cache/local-web-preview` with the commands in [`web/README.md`](../../web/README.md), then:

```sh
python mobile/ios/prepare.py
node mobile/ios/Tests/native-adapter.cjs
xcodebuild test \
  -project mobile/ios/.generated/FigureStudio.xcodeproj \
  -scheme FigureStudio -configuration Debug \
  -destination 'platform=iOS Simulator,name=<installed iPhone or iPad>' \
  -derivedDataPath mobile/ios/.generated/DerivedData \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
```

The generator uses only Python's standard library, verifies every web asset checksum, and creates an Xcode project without third-party project tools. Deployment target is iOS 17+. `ios-simulator-preview.yml` creates a fresh CI simulator, runs XCTest, then retains synthetic reports, screenshots, the Xcode result bundle and an unsigned simulator `.app` archive. That archive cannot be installed on an iPhone or iPad.

The fixed smoke code is enabled only in a DEBUG simulator build, with a separate persistent WebKit test profile. It checks bundled worker initialization, a reference Welch result, tied Mann–Whitney analysis, editable SVG rendering, an exact-copy image check, a real native Files export dialog and its cancellation, and a real editor autosave restored after process termination/relaunch. It also checks HTTP POST rejection, path confinement and native export stream integrity. Native export cancellation and internal file-byte verification do **not** claim successful saving to every Files provider. No user projects are cleared or replaced by the tests.

## Native file integration

WKWebView's standard `<input type="file">` uses the system picker. The early-injected `StudioNativeBridge` implements `saveBlob(blob, name)` and `saveFile({name,mime,base64})`. Blob export transfers sequential 256 KiB chunks to a temporary app-private file, then presents the system export picker. The Promise resolves only after save or explicit cancellation. Cancel, stream errors and subsequent launches remove temporary exports. The preview limits a single export to 256 MiB.

The app exposes its local `Documents` folder as **Figure Studio Preview** under **On My iPhone / On My iPad**. The export picker uses the location remembered by Files. Choose the local app folder and press Save; displaying the picker alone does not save a file. Autosaves remain private in WebKit storage and temporary export streams remain in `tmp`. Opening a project presents an explicit native replacement confirmation. A simulator test now exercises actual project Save, reads the file chosen by the native provider, and reopens it through the existing file input, checking its SHA-256 and restored edits. This test must pass before successful Files save/reimport is claimed for a build.

Apple documents this local folder integration in [File Provider: share files locally](https://developer.apple.com/documentation/fileprovider) and the export starting-location behavior in [UIDocumentPickerViewController.directoryURL](https://developer.apple.com/documentation/uikit/uidocumentpickerviewcontroller/directoryurl). A suggested directory is not a completed save or a guarantee that every provider will support it.

Editable PDF import remains unavailable in the shared WASM engine and gives the existing explicit explanation. This wrapper does not turn a PDF into fake editable artwork. Real-device memory pressure, performance, touch editing, Files providers, background/resume, iOS versions and signed distribution still need device validation. Simulator measurements are not phone performance claims.

Implementation references: [Apple persistent WebKit profiles](https://webkit.org/blog/14423/building-profiles-with-new-webkit-api/), [reply-capable script messages](https://developer.apple.com/documentation/webkit/wkscriptmessagehandlerwithreply), [loopback endpoint binding](https://developer.apple.com/documentation/network/nwparameters/requiredlocalendpoint), and [WebKit file upload defaults](https://developer.apple.com/documentation/webkit/wkuidelegate/webview(_:runopenpanelwith:initiatedbyframe:completionhandler:)).

## iOS 本地开发预览

这是 iPhone／iPad 的开发版本，还不是 App Store 版本或可直接安装到真机的 IPA。编辑器及 Python/WASM 计算依赖随应用一起打包，运行时不需要远程服务器、API 密钥或另一台电脑。没有 Apple 账号也可以在带 Xcode 的 Mac 上编译、运行未签名的模拟器应用。

应用在设备自身的 `127.0.0.1` 上读取打包资源，统计分析、作图和查重通过本地后台线程完成，研究数据不通过 HTTP 提交。0.1.8 模拟器构建仅为主动启动的 Europe PMC 文献检索开放有限例外，发送图型词和手动填写的可选主题，不发送研究数据；其他远程资源仍被阻止，不会自动打开外部浏览器。更新检查只读取 GitHub 官方版本信息，不发送研究数据；本地计算仍可离线使用，具体验证对应的模拟器构建见测试记录。首次本地端口会被记住，确保再次打开仍能找到同一份自动保存和撤销记录；端口冲突时提示重试，不会悄悄切换存储位置。编辑器存储不参与 iCloud 备份；只有用户在系统“文件”界面主动选择云端位置导出，文件才会交给该提供商。

导入使用系统文件选择器；导出按 256 KiB 分块写入临时文件，再打开系统保存界面。只有用户完成保存才返回保存成功，取消会准确返回取消并清理临时文件。开发版本单次导出上限为 256 MiB。

应用的本地 `Documents` 目录在“我的 iPhone／我的 iPad”中显示为 **Figure Studio Preview** 文件夹。导出使用系统文件界面记住的位置。选择上述本地应用文件夹并点击“保存”后才会完成保存，打开窗口本身不算保存成功。自动保存继续存放在私有 WebKit 存储中，临时导出继续使用私有临时目录。重新打开工程会先弹出明确的替换确认。新增模拟器测试会真正保存工程、通过文件选择器重新打开，并核对文件哈希和编辑内容；只有该测试实际通过，才会宣称对应构建的保存和重新导入已验证。

CI 使用全新模拟器和独立测试存储，验证实际 WKWebView 后台计算、指定统计方法、可编辑 SVG、相同图片查重、系统导出取消以及应用重启后的项目恢复。模拟器 `.app` 压缩包不能直接安装到 iPhone／iPad。真机性能、低内存表现、触控体验、系统文件提供商、后台恢复及正式签名发行仍需分别验证；可编辑 PDF 导入继续明确提示暂不支持。
