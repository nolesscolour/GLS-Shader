export function parseSVGPathToPoints(pathString, particleCount, scale = 1.0) {
  // Create a native DOM SVG element in memory
  const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathElement.setAttribute('d', pathString);

  const totalLength = pathElement.getTotalLength();
  const positions = new Float32Array(particleCount * 3);
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const tempPoints = [];

  // Sample points randomly along the total length of the SVG path
  for (let i = 0; i < particleCount; i++) {
    const distance = Math.random() * totalLength;
    const point = pathElement.getPointAtLength(distance);
    
    tempPoints.push(point);

    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  // Calculate center to ensure the point cloud spawns at [0,0,0]
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  for (let i = 0; i < particleCount; i++) {
    const pt = tempPoints[i];
    
    // X axis
    positions[i * 3] = (pt.x - centerX) * scale;
    // Y axis (Invert because SVG Y-axis goes down, WebGL Y-axis goes up)
    positions[i * 3 + 1] = -(pt.y - centerY) * scale;
    // Z axis (Add a tiny bit of random depth to give it volume)
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2.0; 
  }

  return positions;
}