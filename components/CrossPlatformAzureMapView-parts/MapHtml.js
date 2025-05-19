// MapHtml.js - Generates HTML/JS content for WebView and iframe

// Helper to encode SVG icon for the map
const encodeSvgIcon = (svgString) => {
    return 'data:image/svg+xml;base64,' + btoa(svgString);
  };
  
  // Generate the HTML template for map display
  export const generateMapHtml = (azureMapsKey, initialRegion, mapStyle, markerIcons) => {
    if (!azureMapsKey) {
      return `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial; padding: 20px; text-align: center; color: #f44336;">
          <h2>Error: Azure Maps Key Missing</h2>
          <p>The Azure Maps key was not provided to the component.</p>
        </body>
        </html>
      `;
    }
    
    // Stringify the marker icons for insertion into HTML
    const plantPinSvg = markerIcons.plant || '';
    const userLocationSvg = markerIcons.userLocation || '';
    
    return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
    <title>Greener – Azure Maps</title>
    <link
      rel="stylesheet"
      href="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.css"
    />
    <style>
      html,body,#mapContainer{margin:0;padding:0;width:100%;height:100%;}
      .popup-content{padding:12px;max-width:250px;font-family:Arial,Helvetica,sans-serif}
      .popup-content strong{font-size:16px;color:#333}
      .popup-price{font-size:15px;color:#4caf50;font-weight:bold;margin:5px 0}
      .popup-location{font-size:13px;color:#666;margin-bottom:5px}
      .popup-distance{font-size:12px;color:#888;margin-bottom:8px}
      .popup-button{background:#4caf50;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:bold}
      .popup-button:hover{opacity:.9}
      .search-radius{stroke:rgba(76,175,80,0.8);stroke-width:2;stroke-dasharray:5,5;fill:rgba(76,175,80,0.1)}
      .pin-label{background:white;border:2px solid #4caf50;color:#333;font-weight:bold;padding:3px 8px;border-radius:12px;}
      .plant-pin{width:28px;height:36px;}
      .debug-info{position:absolute;bottom:10px;left:10px;background:rgba(255,255,255,0.8);padding:10px;border-radius:5px;font-family:monospace;z-index:1000;max-width:80%;overflow:auto;}
      .my-location-pulse {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #4285f4;
        border: 2px solid white;
        box-shadow: 0 0 0 rgba(66, 133, 244, 0.4);
        animation: pulse 1.5s infinite;
      }
      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(66, 133, 244, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(66, 133, 244, 0);
        }
      }
    </style>
    <script src="https://atlas.microsoft.com/sdk/javascript/mapcontrol/2/atlas.min.js"></script>
    <script src="https://atlas.microsoft.com/sdk/javascript/service/2/atlas-service.min.js"></script>
  </head>
  <body>
    <div id="mapContainer"></div>
    <div id="debug" class="debug-info"></div>
    <script>
      // Function to update debug info
      function updateDebug(message) {
        const debugDiv = document.getElementById('debug');
        if (debugDiv) {
          debugDiv.innerHTML += "<div>" + message + "</div>";
        }
      }
  
      // Set debug visibility - hidden by default
      document.getElementById('debug').style.display = 'none';
  
      // Variables to store map objects
      let map = null;
      let src = null;
      let clusterSrc = null;
      let popup = null;
      let radiusCircle = null;
      let searchCircle = null;
      let myLocationPin = null;
      let userLocationDataSource = null;
      
      // Custom plant pin SVG
      const plantPinSvg = '${plantPinSvg}';
      
      // Create DOM elements for custom markers
      const plantPinImage = document.createElement('img');
      plantPinImage.src = '${encodeSvgIcon(plantPinSvg)}';
  
      // My location arrow svg
      const myLocationSvg = '${userLocationSvg}';
      const myLocationImage = document.createElement('img');
      myLocationImage.src = '${encodeSvgIcon(userLocationSvg)}';
  
      try {
        // Initialize the map
        updateDebug("Creating map object...");
        map = new atlas.Map('mapContainer', {
          center: [${initialRegion.longitude}, ${initialRegion.latitude}],
          zoom: ${initialRegion.zoom},
          view: 'Auto',
          style: '${mapStyle}',
          showLogo: false,
          authOptions: {
            authType: 'subscriptionKey',
            subscriptionKey: '${azureMapsKey}'
          }
        });
  
        // Map ready event
        map.events.add('ready', () => {
          updateDebug("Map is ready! Creating data sources...");
          
          // Add custom marker images
          map.imageSprite.add('plant-pin', plantPinImage).then(() => {
            updateDebug("Added custom plant-pin successfully");
          }).catch(err => {
            updateDebug("Error adding custom plant-pin: " + err.toString());
          });
          
          // Add my location marker image
          map.imageSprite.add('my-location', myLocationImage).then(() => {
            updateDebug("Added my-location icon successfully");
          }).catch(err => {
            updateDebug("Error adding my-location icon: " + err.toString());
          });
          
          // Create data sources
          src = new atlas.source.DataSource();
          clusterSrc = new atlas.source.DataSource(null, {
            cluster: true,
            clusterRadius: 45,
            clusterMaxZoom: 15
          });
          
          // Create a separate data source for user's current location
          userLocationDataSource = new atlas.source.DataSource();
          
          map.sources.add([src, clusterSrc, userLocationDataSource]);
  
          // Add a layer for individual markers
          map.layers.add(new atlas.layer.SymbolLayer(src, null, {
            iconOptions: {
              image: 'plant-pin',  
              anchor: 'bottom',
              allowOverlap: true,
              size: 1.0
            }
          }));
  
          // Add a bubble layer for clusters
          map.layers.add(new atlas.layer.BubbleLayer(clusterSrc, null, {
            radius: 12,
            color: '#4CAF50',
            strokeColor: 'white',
            strokeWidth: 2,
            filter: ['has', 'point_count']
          }));
  
          // Add a symbol layer for cluster labels
          map.layers.add(new atlas.layer.SymbolLayer(clusterSrc, null, {
            iconOptions: { image: 'none' },
            textOptions: {
              textField: ['get', 'point_count_abbreviated'],
              color: 'white',
              size: 12,
              font: ['SegoeUi-Bold']
            },
            filter: ['has', 'point_count']
          }));
  
          // Add user location symbol layer
          map.layers.add(new atlas.layer.SymbolLayer(userLocationDataSource, null, {
            iconOptions: {
              image: 'my-location',
              anchor: 'center',
              allowOverlap: true,
              size: 1.0
            }
          }));
  
          // Create a popup with enhanced styling
          popup = new atlas.Popup({
            pixelOffset: [0, -35],
            closeButton: false,
            fillColor: 'white',
            shadowColor: 'rgba(0,0,0,0.2)',
            shadowBlur: 8
          });
  
          // Create a search radius data source and layer
          radiusCircle = new atlas.source.DataSource();
          map.sources.add(radiusCircle);
          
          // Add a circle layer for search radius with improved styling
          map.layers.add(new atlas.layer.PolygonLayer(radiusCircle, null, {
            fillColor: 'rgba(76, 175, 80, 0.15)',
            fillOpacity: 0.6
          }));
          
          // Add a line layer for search radius border with improved styling
          map.layers.add(new atlas.layer.LineLayer(radiusCircle, null, {
            strokeColor: 'rgba(76, 175, 80, 0.8)',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            strokeOpacity: 0.8
          }));
  
          // Function to create enhanced popup content
          function makePopupContent(props, pos) {
            const div = document.createElement('div');
            div.className = 'popup-content';
            div.innerHTML = \`
              <strong>\${props.title || 'Plant'}</strong>
              <div class="popup-price">$\${parseFloat(props.price || 0).toFixed(2)}</div>
              <div class="popup-location">\${props.location || ''}</div>
              \${props.distance ? '<div class="popup-distance">Distance: ' + props.distance + '</div>' : ''}
            \`;
            const btn = document.createElement('button');
            btn.className = 'popup-button';
            btn.textContent = 'View Details';
            btn.onclick = () => selectProduct(props.id);
            div.appendChild(btn);
            popup.setOptions({ content: div, position: pos });
            popup.open(map);
  
            // Also notify parent immediately
            selectProduct(props.id);
          }
  
          // Function to handle product selection
          function selectProduct(id) {
            updateDebug("Product selected: " + id);
            
            // Notify React Native WebView on mobile
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PIN_CLICKED',
                productId: id
              }));
            } 
            // Notify parent on web via multiple methods
            else {
              try {
                // Try postMessage to parent
                window.parent.postMessage(JSON.stringify({
                  type: 'PIN_CLICKED',
                  productId: id
                }), '*');
                
                // Also dispatch custom event
                document.dispatchEvent(new CustomEvent('pinclicked', {
                  detail: { productId: id }
                }));
                
                updateDebug("Sent pin click notification to parent");
              } catch (e) {
                updateDebug("Error sending pin click to parent: " + e.toString());
              }
            }
          }
  
          // Click event for markers
          map.events.add('click', src, (e) => {
            updateDebug("Marker clicked");
            const s = e.shapes?.[0];
            if (!s) return;
            
            // Close any open popup first
            popup.close();
            
            // Get the properties and coordinates
            const props = s.getProperties();
            const coords = s.getCoordinates();
            
            // Make the popup content
            makePopupContent(props, coords);
          });
  
          // Click event for clusters
          map.events.add('click', clusterSrc, (e) => {
            const shape = e.shapes?.[0];
            if (!shape) return;
            const props = shape.getProperties();
            if (!props.cluster) return;
            const ptCount = props.point_count;
            if (ptCount < 100) {
              map.setCamera({
                center: e.position,
                zoom: map.getCamera().zoom + 1
              });
            } else {
              popup.setOptions({
                content: \`<div class="popup-content" style="text-align:center">
                  <strong>\${ptCount} plants found</strong><br>
                  <button class="popup-button" style="margin-top:10px" onclick="map.setCamera({center:[\${e.position[0]},\${e.position[1]}],zoom:map.getCamera().zoom+2})">
                    Zoom In
                  </button>
                </div>\`,
                position: e.position
              });
              popup.open(map);
            }
          });
          
          // Add map click event handler for coordinate selection
          map.events.add('click', (e) => {
            // Only forward click events that aren't on markers
            if (!e.shapes || e.shapes.length === 0) {
              // Close any open popups
              popup.close();
              
              const coords = e.position;
              sendMsg({
                type: 'MAP_CLICKED',
                coordinates: {
                  latitude: coords[1],
                  longitude: coords[0]
                }
              });
            }
          });
  
          // Signal that map is ready
          sendMsg({ type: 'MAP_READY' });
          
          // Add handler for missing images to prevent errors
          map.events.add('styleimagemissing', (e) => {
            if (e.id === 'plant-pin') {
              updateDebug("Handling missing plant-pin image");
              map.imageSprite.add('plant-pin', plantPinImage).then(() => {
                updateDebug("Added missing plant-pin on demand");
              });
            } else if (e.id === 'my-location') {
              updateDebug("Handling missing my-location image");
              map.imageSprite.add('my-location', myLocationImage).then(() => {
                updateDebug("Added missing my-location on demand");
              });
            }
          });
        });
  
        // Map error event
        map.events.add('error', (e) => {
          updateDebug("Map error: " + JSON.stringify(e.error));
          sendMsg({ 
            type: 'MAP_ERROR', 
            error: e.error.toString(),
            source: e.source 
          });
        });
      } catch (e) {
        updateDebug("Initialization error: " + e.toString());
        sendMsg({ 
          type: 'ERROR', 
          message: e.toString() 
        });
      }
  
      // Function to update markers
      function updateMarkers(list) {
        if (!src || !clusterSrc) {
          updateDebug("Cannot update markers: sources not initialized");
          return;
        }
        
        src.clear();
        clusterSrc.clear();
        
        if (!Array.isArray(list) || !list.length) {
          updateDebug("No products to display on map");
          return;
        }
  
        updateDebug("Adding " + list.length + " products to map");
        const points = list.reduce((arr, p) => {
          const lat = p.latitude;
          const lon = p.longitude;
          
          if (lat == null || lon == null) {
            updateDebug("Product missing coords: " + (p.id || 'unknown'));
            return arr;
          }
          
          const point = new atlas.data.Feature(
            new atlas.data.Point([lon, lat]),
            p
          );
          
          arr.push(point);
          return arr;
        }, []);
  
        if (points.length > 0) {
          updateDebug("Added " + points.length + " points to map");
          src.add(points);
          clusterSrc.add(points);
  
          if (points.length === 1) {
            map.setCamera({
              center: points[0].geometry.coordinates,
              zoom: 13
            });
          } else if (points.length > 1) {
            try {
              const bounds = atlas.data.BoundingBox.fromData(points);
              map.setCamera({
                bounds,
                padding: 50
              });
            } catch (e) {
              updateDebug("Error setting camera bounds: " + e.toString());
              // Just center on first point as fallback
              map.setCamera({
                center: points[0].geometry.coordinates,
                zoom: 10
              });
            }
          }
        } else {
          updateDebug("No points with valid coordinates found");
        }
      }
  
      // Function to draw a radius circle
      function drawRadiusCircle(center, radiusKm) {
        if (!radiusCircle) {
          updateDebug("Cannot draw radius: circle source not initialized");
          return;
        }
        
        radiusCircle.clear();
        
        if (!center || !radiusKm) {
          updateDebug("Invalid center or radius");
          return;
        }
        
        updateDebug("Drawing radius circle: " + radiusKm + "km at [" + center[0] + ", " + center[1] + "]");
        
        try {
          // Create a circle polygon with higher precision for smoother appearance
          const circle = atlas.math.getRegularPolygonPath(
            center,
            radiusKm * 1000, // Convert km to meters
            96, // Number of vertices (smooth circle)
            0, // Start angle
            'meters' // Units
          );
          
          radiusCircle.add(new atlas.data.Feature(
            new atlas.data.Polygon([circle]),
            { radius: radiusKm }
          ));
          
          // Fit map to circle
          const buffer = radiusKm * 0.2; // 20% buffer
          const bounds = new atlas.data.BoundingBox(
            center[0] - buffer,
            center[1] - buffer,
            center[0] + buffer,
            center[1] + buffer
          );
          
          map.setCamera({
            bounds,
            padding: 50
          });
          
          updateDebug("Radius circle drawn successfully");
        } catch (e) {
          updateDebug("Error drawing radius circle: " + e.toString());
        }
      }
  
      // Function to show user's current location
      function showUserLocation(latitude, longitude) {
        if (!userLocationDataSource) {
          updateDebug("Cannot show user location: data source not initialized");
          return;
        }
        
        userLocationDataSource.clear();
        
        if (latitude === undefined || longitude === undefined) {
          updateDebug("Invalid user location coordinates");
          return;
        }
        
        updateDebug("Showing user location at: " + latitude + ", " + longitude);
        
        // Add a point for the user location with custom properties
        userLocationDataSource.add(new atlas.data.Feature(
          new atlas.data.Point([longitude, latitude]),
          { type: 'userLocation' }
        ));
        
        // Center the map on the user's location
        map.setCamera({
          center: [longitude, latitude],
          zoom: 15
        });
      }
  
      // Messaging bridge
      function sendMsg(obj) {
        const str = JSON.stringify(obj);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(str);
        } else {
          window.parent?.postMessage(str, '*');
        }
      }
  
      // Handle incoming messages
      window.handleMessage = (raw) => {
        try {
          const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
          updateDebug("Received message: " + msg.type);
          
          if (msg.type === 'UPDATE_PRODUCTS') {
            try {
              updateMarkers(msg.products);
            } catch (e) {
              updateDebug("Error updating products: " + e.toString());
            }
          }
          
          if (msg.type === 'SET_REGION') {
            try {
              map.setCamera({
                center: [msg.longitude, msg.latitude],
                zoom: msg.zoom || map.getCamera().zoom
              });
            } catch (e) {
              updateDebug("Error setting region: " + e.toString());
            }
          }
          
          if (msg.type === 'SELECT_PRODUCT') {
            try {
              const feats = src.getShapes();
              for (const f of feats) {
                if (f.getProperties().id === msg.productId) {
                  const pos = f.getCoordinates();
                  makePopupContent(f.getProperties(), pos);
                  map.setCamera({
                    center: pos,
                    zoom: 15
                  });
                  break;
                }
              }
            } catch (e) {
              updateDebug("Error selecting product: " + e.toString());
            }
          }
          
          if (msg.type === 'DRAW_RADIUS') {
            try {
              drawRadiusCircle(
                [msg.longitude, msg.latitude],
                msg.radius
              );
            } catch (e) {
              updateDebug("Error drawing radius: " + e.toString());
            }
          }
          
          if (msg.type === 'CLEAR_RADIUS') {
            try {
              radiusCircle.clear();
            } catch (e) {
              updateDebug("Error clearing radius: " + e.toString());
            }
          }
          
          if (msg.type === 'SHOW_MY_LOCATION') {
            try {
              showUserLocation(msg.latitude, msg.longitude);
            } catch (e) {
              updateDebug("Error showing location: " + e.toString());
            }
          }
          
        } catch (e) {
          updateDebug("Error handling message: " + e.toString());
        }
      };
  
      // Set up event listener on document for web integration
      document.addEventListener('message', function(e) {
        try {
          if (e.data) {
            window.handleMessage(e.data);
          }
        } catch (err) {
          updateDebug("Error in document message handler: " + err.toString());
        }
      });
    </script>
  </body>
  </html>
  `;
  };