import Foundation
import AVFoundation
import Vision
import CoreImage

// 本期5.4秒同源人物层：使用系统视频人物分割，不覆盖旧遮罩和原片。
guard CommandLine.arguments.count == 3 else { fatalError("需要源视频和新输出目录") }
let source = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let maskURL = output.appendingPathComponent("vision-alpha.r1.gray")
guard !FileManager.default.fileExists(atPath: maskURL.path) else { fatalError("禁止覆盖已有候选遮罩") }
let asset = AVURLAsset(url: source)
guard let track = asset.tracks(withMediaType: .video).first else { fatalError("无视频轨") }
let reader = try AVAssetReader(asset: asset)
let pixels = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
pixels.alwaysCopiesSampleData = false
reader.add(pixels)
guard reader.startReading() else { fatalError("不能读源视频") }
let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = .accurate
request.outputPixelFormat = kCVPixelFormatType_OneComponent8
let handler = VNSequenceRequestHandler()
let context = CIContext(options: [.cacheIntermediates: false])
FileManager.default.createFile(atPath: maskURL.path, contents: nil)
let file = try FileHandle(forWritingTo: maskURL)
defer { try? file.close() }
let width = 1920, height = 1080
var count = 0
while let sample = pixels.copyNextSampleBuffer() {
  try autoreleasepool {
    guard let input = CMSampleBufferGetImageBuffer(sample) else { fatalError("缺源帧") }
    try handler.perform([request], on: input)
    guard let mask = request.results?.first?.pixelBuffer else { fatalError("人物分割无结果") }
    let ci = CIImage(cvPixelBuffer: mask)
    let image = ci.transformed(by: CGAffineTransform(scaleX: CGFloat(width)/ci.extent.width, y: CGFloat(height)/ci.extent.height))
    var data = [UInt8](repeating: 0, count: width * height)
    context.render(image, toBitmap: &data, rowBytes: width, bounds: CGRect(x:0,y:0,width:width,height:height), format: .L8, colorSpace: CGColorSpaceCreateDeviceGray())
    try file.write(contentsOf: Data(data))
    count += 1
    if count % 30 == 0 { print("人物遮罩候选 \(count) 帧") }
  }
}
guard reader.status == .completed && count == 162 else { fatalError("帧数不完整：\(count)，\(reader.error?.localizedDescription ?? "未知")") }
print("人物遮罩162帧候选生成；尚未逐帧验收")
