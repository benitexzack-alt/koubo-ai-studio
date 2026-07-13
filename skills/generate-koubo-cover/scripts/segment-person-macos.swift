import AppKit
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

guard CommandLine.arguments.count == 3 else {
  FileHandle.standardError.write(Data("用法：swift segment-person-macos.swift <input.png> <output.png>\n".utf8))
  exit(1)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])

guard
  let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
  let sourceImage = CGImageSourceCreateImageAtIndex(source, 0, nil)
else {
  throw NSError(domain: "KouboPersonSegmentation", code: 1, userInfo: [NSLocalizedDescriptionKey: "无法读取输入图像"])
}

let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = .accurate
request.outputPixelFormat = kCVPixelFormatType_OneComponent8

let handler = VNImageRequestHandler(cgImage: sourceImage, orientation: .up)
try handler.perform([request])

guard let observation = request.results?.first else {
  throw NSError(domain: "KouboPersonSegmentation", code: 2, userInfo: [NSLocalizedDescriptionKey: "未检测到可用人物遮罩"])
}

let foreground = CIImage(cgImage: sourceImage)
let rawMask = CIImage(cvPixelBuffer: observation.pixelBuffer)
let scale = CGAffineTransform(
  scaleX: foreground.extent.width / rawMask.extent.width,
  y: foreground.extent.height / rawMask.extent.height
)
let mask = rawMask
  .transformed(by: scale)
  .clampedToExtent()
  .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: 0.7])
  .cropped(to: foreground.extent)
let context = CIContext(options: [.useSoftwareRenderer: false])
let width = sourceImage.width
let height = sourceImage.height
let colorSpace = CGColorSpaceCreateDeviceRGB()
var rgba = [UInt8](repeating: 0, count: width * height * 4)
var alpha = [UInt8](repeating: 0, count: width * height)

context.render(
  foreground,
  toBitmap: &rgba,
  rowBytes: width * 4,
  bounds: foreground.extent,
  format: .RGBA8,
  colorSpace: colorSpace
)
context.render(
  mask,
  toBitmap: &alpha,
  rowBytes: width,
  bounds: foreground.extent,
  format: .L8,
  colorSpace: nil
)

for index in 0..<(width * height) {
  rgba[index * 4 + 3] = alpha[index]
}

guard let provider = CGDataProvider(data: Data(rgba) as CFData) else {
  throw NSError(domain: "KouboPersonSegmentation", code: 3, userInfo: [NSLocalizedDescriptionKey: "无法创建 RGBA 数据"])
}
let bitmapInfo = CGBitmapInfo.byteOrder32Big.union(
  CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue)
)
guard let outputImage = CGImage(
  width: width,
  height: height,
  bitsPerComponent: 8,
  bitsPerPixel: 32,
  bytesPerRow: width * 4,
  space: colorSpace,
  bitmapInfo: bitmapInfo,
  provider: provider,
  decode: nil,
  shouldInterpolate: true,
  intent: .defaultIntent
) else {
  throw NSError(domain: "KouboPersonSegmentation", code: 4, userInfo: [NSLocalizedDescriptionKey: "无法生成透明人物图层"])
}

try FileManager.default.createDirectory(
  at: outputURL.deletingLastPathComponent(),
  withIntermediateDirectories: true
)
guard let destination = CGImageDestinationCreateWithURL(
  outputURL as CFURL,
  UTType.png.identifier as CFString,
  1,
  nil
) else {
  throw NSError(domain: "KouboPersonSegmentation", code: 5, userInfo: [NSLocalizedDescriptionKey: "无法创建 PNG 输出"])
}

CGImageDestinationAddImage(destination, outputImage, nil)
guard CGImageDestinationFinalize(destination) else {
  throw NSError(domain: "KouboPersonSegmentation", code: 6, userInfo: [NSLocalizedDescriptionKey: "PNG 写入失败"])
}

print("\(outputURL.path)\t\(sourceImage.width)x\(sourceImage.height)")
