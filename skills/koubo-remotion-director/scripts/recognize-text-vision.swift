#!/usr/bin/env swift

import AppKit
import Darwin
import Foundation
import Vision

func fail(_ message: String) -> Never {
  if let data = "\(message)\n".data(using: .utf8) {
    FileHandle.standardError.write(data)
  }
  exit(1)
}

guard CommandLine.arguments.count == 2 else {
  fail("VISION_OCR_IMAGE_ARGUMENT_REQUIRED")
}

let imageURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard
  let image = NSImage(contentsOf: imageURL),
  let tiffData = image.tiffRepresentation,
  let bitmap = NSBitmapImageRep(data: tiffData),
  let cgImage = bitmap.cgImage
else {
  fail("VISION_OCR_IMAGE_INVALID")
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["zh-Hans"]
request.usesLanguageCorrection = false

do {
  try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
} catch {
  fail("VISION_OCR_REQUEST_FAILED:\(error.localizedDescription)")
}

let observations = request.results ?? []
let recognized = observations.compactMap { observation -> (String, CGRect)? in
  guard let candidate = observation.topCandidates(1).first else { return nil }
  return (candidate.string, observation.boundingBox)
}.sorted { left, right in
  let verticalDelta = abs(left.1.midY - right.1.midY)
  if verticalDelta < 0.08 {
    return left.1.minX < right.1.minX
  }
  return left.1.midY > right.1.midY
}.map(\.0).joined()

print(recognized)
