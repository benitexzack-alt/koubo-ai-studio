import CoreImage
import Foundation
import ImageIO
import Vision

enum CutoutError: Error, CustomStringConvertible {
    case usage
    case imageLoad(String)
    case noPerson

    var description: String {
        switch self {
        case .usage:
            return "用法：swift extract-person.swift <input-image> <output-png>"
        case .imageLoad(let path):
            return "无法读取图片：\(path)"
        case .noPerson:
            return "没有检测到可分离的人物。"
        }
    }
}

func loadCGImage(at url: URL) throws -> CGImage {
    guard
        let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
        throw CutoutError.imageLoad(url.path)
    }
    return image
}

do {
    guard CommandLine.arguments.count == 3 else {
        throw CutoutError.usage
    }

    let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
    let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
    let inputImage = try loadCGImage(at: inputURL)
    let handler = VNImageRequestHandler(cgImage: inputImage, orientation: .up)
    let request = VNGeneratePersonSegmentationRequest()
    request.qualityLevel = .accurate
    request.outputPixelFormat = kCVPixelFormatType_OneComponent8

    try handler.perform([request])
    guard let observation = request.results?.first else {
        throw CutoutError.noPerson
    }

    let sourceImage = CIImage(cgImage: inputImage)
    let rawMask = CIImage(cvPixelBuffer: observation.pixelBuffer)
    let scaledMask = rawMask
        .transformed(by: CGAffineTransform(
            scaleX: sourceImage.extent.width / rawMask.extent.width,
            y: sourceImage.extent.height / rawMask.extent.height
        ))
        .cropped(to: sourceImage.extent)
    let transparent = CIImage(color: .clear).cropped(to: sourceImage.extent)
    let maskedImage = sourceImage.applyingFilter(
        "CIBlendWithMask",
        parameters: [
            kCIInputBackgroundImageKey: transparent,
            kCIInputMaskImageKey: scaledMask,
        ]
    )
    let context = CIContext(options: [.cacheIntermediates: false])
    let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!

    try FileManager.default.createDirectory(
        at: outputURL.deletingLastPathComponent(),
        withIntermediateDirectories: true
    )
    try context.writePNGRepresentation(
        of: maskedImage,
        to: outputURL,
        format: .RGBA8,
        colorSpace: colorSpace
    )

    print("人物抠像已生成：\(outputURL.path)")
} catch {
    fputs("\(error)\n", stderr)
    exit(1)
}
