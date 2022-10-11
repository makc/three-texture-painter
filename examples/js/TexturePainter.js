/**
* @author ScieCode / https://sciecode.github.io/
*/

// TODO:
// - Implement normal falloff.
// - Fix public and private interface. Variable naming.

// - Showcase

// optional:

// - BufferGeometry
// - Implement bleed clip;
// - Implement geometry occlusion.


THREE.TexturePainter = function ( renderer, camera, mesh, src ) {

	this.renderer = renderer;

	this.camera = camera;

	this.mesh = mesh;

	this.enabled = false;

	this.backfaceCulling = true;

	this.reference = new THREE.Vector3();

	//
	// public methods
	//

	this.update = function() {

		if ( ! scope.camera.position.equals( cameraPosition ) )
			cameraUpdated = true;

		scope.renderer.autoClear = false;
		scope.renderer.render( scope.scene, scope.ortho );

	};

	this.resize = function ( ) {

		aspect = window.innerWidth / window.innerHeight;

		cursorUnits = cursorSize / frustumSize / aspect;

		scope.ortho.left = - frustumSize * aspect / 2;
		scope.ortho.right = frustumSize * aspect / 2;
		scope.ortho.top = frustumSize / 2;
		scope.ortho.bottom = - frustumSize / 2;

		scope.ortho.updateProjectionMatrix();

		cameraUpdated = true;

	};

	//
	// internals
	//

	var scope = this;

	var verticesDict;

	var cursorSize = 5;
	var frustumSize = 100;
	var cameraUpdated = true;

	var aspect = window.innerWidth / window.innerHeight;
	var cursorUnits = cursorSize / frustumSize / aspect;
	var cameraPosition = scope.camera.position.clone();

	var initialize = function( src ) {

		// canvas initialization
		scope.canvas = document.createElement( "canvas" );
		scope.canvas.width = scope.canvas.height = 4096;

		scope.ctx = scope.canvas.getContext( "2d" );

		scope.texture = scope.mesh.material.map || new THREE.Texture( undefined, THREE.UVMapping );
		scope.texture.image = scope.canvas;

		scope.radius = scope.canvas.width * cursorUnits;

		scope.bg = document.createElement( "img" );
		scope.bg.crossOrigin = '';

		scope.bg.addEventListener( "load", function () {

			scope.canvas.width = scope.bg.naturalWidth;
			scope.canvas.height = scope.bg.naturalHeight;

			scope.ctx.drawImage( scope.bg, 0, 0 );
			scope.texture.needsUpdate = true;

		}, false );

		if ( src ) scope.bg.src = src;
		else scope.bg.src = "textures/UV_Grid_Sm.jpg";

		// cursor initialization
		scope.scene = new THREE.Scene();
		scope.scene.background = null;

		scope.ortho = new THREE.OrthographicCamera( frustumSize * aspect / - 2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / - 2, 0, 10 );
		scope.ortho.position.z = 50;
		scope.ortho.lookAt( scope.scene.position );

		var cursorTexture = new THREE.Texture( undefined, THREE.UVMapping, THREE.MirroredRepeatWrapping, THREE.MirroredRepeatWrapping );
		var cursorMaterial = new THREE.MeshBasicMaterial( { map: cursorTexture, transparent: true } );
		var cursorGeometry = new THREE.PlaneBufferGeometry( cursorSize, cursorSize, 1, 1 );

		scope.cursor = new THREE.Mesh( cursorGeometry, cursorMaterial );
		scope.cursor.position.copy( scope.ortho.position );
		scope.cursor.rotation.copy( scope.ortho.rotation );
		scope.scene.add( scope.cursor );

		var canvasCursor = document.createElement( "canvas" );
		canvasCursor.width = canvasCursor.height = 128;
		var context = canvasCursor.getContext( "2d" );

		cursorTexture.image = canvasCursor;

		context.lineWidth = 8;
		context.strokeStyle = "rgba(0, 0, 0, 0.7)";

		context.clearRect( 0, 0, canvasCursor.width, canvasCursor.height );

		context.ellipse(
			canvasCursor.width/2, // x
			canvasCursor.height/2, // y
			canvasCursor.width/2 - context.lineWidth/2 - 8, // radiusX
			canvasCursor.height/2 - context.lineWidth/2 - 8, // radiusY
			0, // rotation
			0, // angle start
			Math.PI*2 // angle end
		 );

		context.stroke();

		cursorTexture.needsUpdate = true;

	} ();

	function verticesReset() {
		verticesDict = Array( scope.mesh.geometry.vertices.length ).fill( undefined );
		cameraPosition.copy( scope.camera.position );
		cameraUpdated = false;
	}

	// canvas-functions
	function faceClip ( clip ) {

		scope.ctx.beginPath();
		scope.ctx.moveTo( clip[0].x * scope.canvas.width, clip[0].y * scope.canvas.height );
		scope.ctx.lineTo( clip[1].x * scope.canvas.width, clip[1].y * scope.canvas.height );
		scope.ctx.lineTo( clip[2].x * scope.canvas.width, clip[2].y * scope.canvas.height );
		scope.ctx.closePath();
		scope.ctx.clip();

	};

	function faceDraw( vectors ) {

		var width = scope.canvas.width;
		var height = scope.canvas.height;
		var length = vectors.length / 2;

		scope.ctx.fillStyle = "rgba( 14, 158, 54, 1 )";

		// move to the first point
		scope.ctx.beginPath();
		scope.ctx.moveTo( vectors[length-1].x * width, vectors[length-1].y * height );

		for (i = 0; i < length; i ++) {

		  scope.ctx.quadraticCurveTo(
				vectors[ length + i ].x * width, // cp1.x
				vectors[ length + i ].y * height, // cp1.y
				vectors[ i ].x * width, // p2.x
				vectors[ i ].y * height // p2.y
			);

		}
		scope.ctx.fill();

	};

	function draw( faces ) {

		if ( ! scope.ctx || ! scope.enabled || ! faces ) return;

		faces.forEach( function( face ) {

			scope.ctx.save();

			faceClip( face.clip );
			faceDraw( face.vectors ); // face.points

			scope.ctx.restore();

		});

		scope.texture.needsUpdate = true;

	};

	// world-functions
	function calculateClipVertex( vertex ) {

		var v1 = vertex.clone();
		scope.mesh.localToWorld( v1 ); // local-space to world-space
		return v1.project( scope.camera ); // world-space to clip-space;

	};

	function getClipVertex( vertexID ) {

		if ( verticesDict[ vertexID ] ) return verticesDict[ vertexID ].clone().sub( scope.reference );

		verticesDict[ vertexID ] = calculateClipVertex( scope.mesh.geometry.vertices[ vertexID ] );

		return verticesDict[ vertexID ];

	};

	function faceIntersectsClip( clip, face ) {

	 var vA = getClipVertex( face.a );
	 var vB = getClipVertex( face.b );
	 var vC = getClipVertex( face.c );

	 if ( clip.intersectsTriangle( new THREE.Triangle( vA, vB, vC ) ) )  return true;
	 return false;

 };

	function getDirectionFromCamera( x, y, origin ) {

		var v1 = new THREE.Vector3();

		v1.set( scope.reference.x + x, scope.reference.y + y * aspect, 0.5 );
		v1.unproject( scope.camera ).sub( origin );

		return v1.normalize();

	};

	function getDirections( directions, origin ) {

		for ( var i = 0; i < 4; i++ ) {

			var sign = ( i < 2 ) ? 1 : -1;

			var x = ( i % 2) * sign * cursorUnits;
			var y = ( (i+1) % 2) * sign * cursorUnits;

			directions.push( getDirectionFromCamera( x, y, origin ) );

		}

		for ( var i = 0; i < 4; i++ ) {

			var x = ( ( (i%3) == 0 ) ? -1 : 1 ) * cursorUnits;
			var y = ( ( i < 2 ) ? 1 : -1 ) * cursorUnits;

			directions.push( getDirectionFromCamera( x, y, origin ) );

		}

	};

	function getDrawLocations () {

		var point, node;
		var locations = [];
		var intersects = [];
		var directions = [];

		var ray = new THREE.Ray();
		var vA = new THREE.Vector3();
		var vB = new THREE.Vector3();
		var vC = new THREE.Vector3();
		var origin = new THREE.Vector3().setFromMatrixPosition( scope.camera.matrixWorld );

		var faces = scope.mesh.geometry.faces;
		var vertices = scope.mesh.geometry.vertices;
		var uvs = scope.mesh.geometry.faceVertexUvs[0];

		// set clip-space.
		var min = new THREE.Vector3( - cursorUnits, - cursorUnits*aspect, - 0.1 );
		var max = new THREE.Vector3( + cursorUnits, + cursorUnits*aspect, + scope.camera.far );
		var clip = new THREE.Box3( min, max );

		// get brush vector directions from camera;
		getDirections( directions, origin );

		if ( cameraUpdated ) verticesReset();

		// get faces that intersect with mouse clip-space.
		for ( var i = 0; i < faces.length; i++ ) {

			var face = faces[i];
			var deltaAngle = getDirectionFromCamera( 0, 0, origin ).dot( face.normal );

			// skip - if doesn't appear on camera | update to include brush delta fov
			if ( scope.backfaceCulling && deltaAngle >= 0  )  continue;

			if ( faceIntersectsClip( clip, face ) ) intersects.push(i);

		}

		// set draw locations for each intersecting face.
		for ( var i = 0; i < intersects.length; i++ ) {
			var uvclip = [];
			var vectors = [];

			// vertices in uv texture-space.
			for ( var k = 0; k < 3; k++ ) {
				node = uvs[ intersects[i] ][k].clone();
				scope.mesh.material.map.transformUv( node );
				uvclip.push( node );
			}

			var face = faces[ intersects[i] ];

			scope.mesh.localToWorld( vA.copy( vertices[ face.a ] ) );
			scope.mesh.localToWorld( vB.copy( vertices[ face.b ] ) );
			scope.mesh.localToWorld( vC.copy( vertices[ face.c ] ) );

			var plane = new THREE.Plane().setFromNormalAndCoplanarPoint( face.normal, vA );

			for ( var v = 0; v < directions.length; v++ ) {

				ray.set( origin, directions[v] );

				if ( ! ray.intersectsPlane( plane ) ) break;

				// find brush projected point in world-space.
				point = ray.intersectPlane( plane, new THREE.Vector3() );

				// bruch center in uv texture-space.
				var uv = THREE.Triangle.getUV( point, vA, vB, vC, uvclip[0], uvclip[1], uvclip[2], new THREE.Vector2() );

				vectors.push( uv );

			}

			if ( vectors.length != 8 ) continue;

			var loc = { vectors: vectors, clip: uvclip };

			// push to list of canvas draw locations.
			locations.push( loc );

		}

		return locations;

	};

	// mouse methods
	function updateMouse( evt ) {

		var rect = renderer.domElement.getBoundingClientRect();
		var array = [ ( evt.clientX - rect.left ) / rect.width, ( evt.clientY - rect.top ) / rect.height ];

		scope.reference.set( ( array[0] * 2 ) - 1, - ( array[1] * 2 ) + 1, 0 );

	};

	function updateCursor() {

		scope.cursor.position.copy( scope.ortho.position );
		scope.cursor.translateX( aspect * scope.reference.x * 50 );
		scope.cursor.translateY( scope.reference.y * 50 );

	};

	// listeners
	function onMouseMove( evt ) {

		evt.preventDefault();

		updateMouse( evt );

		updateCursor();

		if ( scope.enabled ) draw( getDrawLocations() );

	}

	function onMouseDown( evt ) {

		evt.preventDefault();

		if ( evt.button != 0 ) return;

		scope.enabled = true;

		onMouseMove(evt);

	}

	function onMouseUp( evt ) {

		evt.preventDefault();

		if ( evt.button != 0 ) return;

		scope.enabled = false;

	};

	// bind listeners
	renderer.domElement.addEventListener( 'mousemove', onMouseMove, false );
	renderer.domElement.addEventListener( 'mousedown', onMouseDown, false );
	renderer.domElement.addEventListener( 'mouseup', onMouseUp, false );

};
