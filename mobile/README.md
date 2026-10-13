# Local mobile development previews

English first · [中文](#中文)

These are development wrappers for the local Figure Studio browser engine. They are not an application-store release or a claim of support for every phone and tablet. Platform build and test evidence must be recorded separately from desktop-browser and DOM simulations.

## Architecture

Both wrappers bundle the blank editor, scientific Python/WASM runtime, libraries and public-file checksums. Analysis and rendering run inside a local Web Worker. Research data is passed through worker messages, never to a remote analysis endpoint. Android serves bundled assets through its local WebView asset handler; iOS serves bundled public files over a loopback-only asset server. The 0.1.6 development preview allows the optional Europe PMC lookup only when the user starts a search, sending predefined chart terms and an optional typed topic. Local calculation remains available offline. See [literature search scope](../README.en.md#examples-in-papers).

The editor uses the system's local file chooser. Exported figures, image-check evidence and saved projects use a native file-saving adapter. A cancelled picker must not be reported as a saved file. A failed native save must not fall back to a browser download that the application cannot deliver. Browser and desktop downloads retain their existing behavior.

Each platform injects this interface before the editor's scripts run:

```js
window.StudioNativeBridge = {
  platform: 'android', // or 'ios'
  bundledAssets: true,
  async saveBlob(blob, name) {
    // Resolve only after the native destination accepted the complete file.
    return { saved: true, name, bytes: blob.size };
    // User cancellation instead resolves to { cancelled: true }.
    // Storage and transport failures reject the promise.
  }
};
```

Platform adapters stream bounded chunks to temporary/local destinations and validate their page origin. `bundledAssets` disables the optional web service-worker installer because the program files are already included in the native application. Native bridges are not installed in ordinary desktop or browser exports.

## Build and validation

- [Native mobile validation record](../docs/mobile-preview-validation.md): Android, iPhone and iPad project Save/Open, native screenshots and process-restart evidence; physical-device checks remain separate.
- [Android sources](android/): development APK and emulator checks; production signing and store distribution are separate steps.
- [iPhone/iPad sources](ios/): Xcode build and simulator checks; a simulator application cannot be installed on a physical iPhone or distributed through TestFlight.
- [Existing browser validation](../docs/local-browser-preview-validation.md): calculation, offline and desktop-browser evidence, with explicit limits.
- [Existing Mac validation](../docs/macos-preview-validation.md): separately built native Mac previews.

A paid Apple Developer account is not required to compile and test in the simulator. Signing, physical-device distribution and TestFlight remain separate from this development workflow. Mobile editable-PDF import is not implemented by this browser engine; the editor reports that limitation instead of treating a rasterized page as editable artwork.

## 中文

这里是 Figure Studio 本地计算引擎的移动端开发封装，不是已经上架的正式手机产品，也不代表所有手机和平板均已验证。原生构建、模拟器和真机的证据必须分开记录，不能用桌面浏览器或 DOM 模拟代替真机测试。

程序随包提供空白编辑器、Python/WASM 科研运行库和文件校验信息。分析与绘图在设备内的计算线程完成，研究数据通过内部消息传递，不交给远程分析接口。Android 使用本地资源处理器；iOS 的资源服务只监听本机回环地址，只读取包内公共程序文件。0.1.6 开发预览版仅在用户主动查找时允许可选的 Europe PMC 检索，发送预设图型词和手动填写的可选主题，本地计算仍可离线使用。详见[文献检索范围](../README.zh-CN.md#文献作图实例)。

导入使用系统文件选择器。图片、查重证据和工程通过原生接口保存，写入成功才提示完成；用户取消不能误报已保存，保存失败也不能退回无法交付文件的浏览器下载。普通桌面与浏览器的下载方式保留。

Android 开发 APK、iPhone/iPad 模拟器应用和真正的应用商店发行是不同的交付物。模拟器编译测试不需要付费 Apple 开发者账号；模拟器应用不能直接安装到真实 iPhone，设备签名分发和 TestFlight 是后续步骤。当前移动计算引擎尚未实现可编辑 PDF 导入，会明确提示原因，不用栅格化页面冒充可编辑图形。

[原生移动端验证记录](../docs/mobile-preview-validation.md#中文)列出了 Android、iPhone／iPad 工程保存与打开、原生截图、模拟器运行及进程重启恢复的证据；真机检查另行记录。
