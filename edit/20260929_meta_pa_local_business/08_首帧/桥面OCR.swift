import AppKit
import CoreImage
import Vision
import Foundation
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let source = CIImage(contentsOf: url)!
let h = source.extent.height
let quads: [(String, [[Double]])] = [
  ("房态", [[348,403],[683,374],[727,485],[352,530]]),
  ("价格", [[699,374],[981,352],[1065,458],[736,489]]),
  ("退订", [[994,350],[1276,322],[1420,431],[1077,461]])
]
let context = CIContext()
for (expected, q) in quads {
  let filter = CIFilter(name: "CIPerspectiveCorrection")!
  filter.setValue(source, forKey: kCIInputImageKey)
  for (key, point) in zip(["inputTopLeft","inputTopRight","inputBottomRight","inputBottomLeft"], q) {
    filter.setValue(CIVector(x: point[0], y: h-point[1]), forKey: key)
  }
  let output = filter.outputImage!
  let scaled = output.transformed(by: CGAffineTransform(scaleX: 3, y: 3))
  let cg = context.createCGImage(scaled, from: scaled.extent)!
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.recognitionLanguages = ["zh-Hans"]
  request.usesLanguageCorrection = false
  try VNImageRequestHandler(cgImage: cg).perform([request])
  let text = (request.results ?? []).compactMap{$0.topCandidates(1).first?.string}.joined().replacingOccurrences(of: " ", with: "")
  let result: [String:Any] = ["expected":expected,"recognized":text,"exactMatch":expected == text,"sourceQuad":q]
  print(String(data: try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]), encoding: .utf8)!)
}
