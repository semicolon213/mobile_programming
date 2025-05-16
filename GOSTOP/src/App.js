import './App.css'
import { useState, useEffect, useRef, useCallback } from 'react'

// App 컴포넌트 정의
function App() {
  // 이동수단, 시간, 주소 상태값 선언
  const [selectedTransports, setSelectedTransports] = useState([])
  const [time, setTime] = useState(20)
  const [address, setAddress] = useState('')
  const [locations, setLocations] = useState([])

  // 지도, 마커, 원, 폴리곤 등 지도 객체를 저장할 ref 선언
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const outerCircleRef = useRef(null);
  const innerCircleRef = useRef(null);
  const ringPolygonRef = useRef(null);

  // 이동수단 토글 함수
  const toggleTransport = (type) => {
    setSelectedTransports((prev) => {
      // 자동차가 선택된 상태에서 버스/지하철 선택 방지
      if ((type === 'bus' || type === 'subway') && prev.includes('car') && !prev.includes(type)) {
        return prev;
      }
      // 버스/지하철이 선택된 상태에서 자동차 선택 방지
      if (type === 'car' && (prev.includes('bus') || prev.includes('subway')) && !prev.includes('car')) {
        return prev;
      }
      // 버스/지하철 선택 시 도보도 자동 선택
      if ((type === 'bus' || type === 'subway')) {
        if (prev.includes(type)) {
          // 선택 해제
          return prev.filter((t) => t !== type);
        } else {
          // 선택
          let newTransports = [...prev, type];
          if (!prev.includes('walking')) {
            newTransports.push('walking');
          }
          // 중복 제거
          return Array.from(new Set(newTransports));
        }
      }
      // 도보 해제 시 버스/지하철도 함께 해제
      if (type === 'walking') {
        if (prev.includes('walking')) {
          return prev.filter((t) => t !== 'walking' && t !== 'bus' && t !== 'subway');
        } else {
          return [...prev, 'walking'];
        }
      }
      // 기본 토글 (자동차 등)
      return prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
    });
  }

  // 현재 위치 가져오기 함수 (주소 변환 포함)
  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;

          if (latitude !== undefined && longitude !== undefined) {
            // Tmap API로 위경도를 주소로 변환
            const appKey = 'US3lRlDB4J7h64o8wkq6kUYZAtYW44e7BGFUBz58';
            const url = `https://apis.openapi.sk.com/tmap/geo/reversegeocoding?version=1&lat=${latitude}&lon=${longitude}&coordType=WGS84GEO&addressType=A10&appKey=${appKey}`;

            fetch(url)
              .then(response => response.json())
              .then(data => {
                if (data && data.addressInfo) {
                  const { legalDong, roadName, buildingName } = data.addressInfo;
                  const simplifiedAddress = `${legalDong} ${roadName}${buildingName ? ' ' + buildingName : ''}`;
                  setAddress(simplifiedAddress);
                } else {
                  setAddress(`위도: ${latitude.toFixed(5)}, 경도: ${longitude.toFixed(5)}`);
                }
                // 지도에 마커 표시
                if (window.Tmapv2 && mapInstanceRef.current) {
                  if (markerRef.current) {
                    markerRef.current.setMap(null);
                  }
                  markerRef.current = new window.Tmapv2.Marker({
                    position: new window.Tmapv2.LatLng(latitude, longitude),
                    map: mapInstanceRef.current,
                  });
                  mapInstanceRef.current.setCenter(new window.Tmapv2.LatLng(latitude, longitude));
                }
              })
              .catch((error) => {
                console.error(error);
                alert('주소 변환에 실패했습니다.');
                setAddress(`위도: ${latitude.toFixed(5)}, 경도: ${longitude.toFixed(5)}`);
              });
          }
        },
        () => {
          alert('위치를 가져오는 데 실패했습니다.');
        }
      );
    } else {
      alert('이 브라우저는 위치를 지원하지 않습니다.');
    }
  }, [])

  // 컴포넌트 마운트 시 현재 위치 가져오고 지도 생성
  useEffect(() => {
    getCurrentLocation()
    if (window.Tmapv2 && mapRef.current) {
      mapInstanceRef.current = new window.Tmapv2.Map(mapRef.current, {
        center: new window.Tmapv2.LatLng(37.49241689559544, 127.03171389453507),
        width: "100%",
        height: "100%",
        zoom: 15,
        zoomControl: false,
        scrollwheel: true,
      });
    }
  }, [getCurrentLocation])

  useEffect(() => {
    fetch(process.env.PUBLIC_URL + '/locations.csv')
      .then(res => res.text())
      .then(text => {
        // CSV 파싱 (첫 줄은 헤더)
        const lines = text.trim().split('\n').slice(1);
        const locs = lines.map(line => {
          const cols = line.split(',');
          const name = cols[0]; // 관광지명
          const lat = parseFloat(cols[4]);
          const lng = parseFloat(cols[5]);
          if (!isNaN(lat) && !isNaN(lng)) {
            return { name, lat, lng };
          }
          return null;
        }).filter(Boolean);
        console.log('CSV에서 파싱된 위치:', locs); // <-- 여기 추가
        setLocations(locs);
      });
  }, []);

  // 이동수단/시간 변경 시 원, 도넛형 영역 그리기
  useEffect(() => {
    if (!markerRef.current || !mapInstanceRef.current) {
      return;
    }
    // 기존 원/폴리곤 제거
    if (outerCircleRef.current) {
      outerCircleRef.current.setMap(null);
      outerCircleRef.current = null;
    }
    if (innerCircleRef.current) {
      innerCircleRef.current.setMap(null);
      innerCircleRef.current = null;
    }
    if (ringPolygonRef.current) {
      ringPolygonRef.current.setMap(null);
      ringPolygonRef.current = null;
    }
    if (selectedTransports.length === 0) {
      return;
    }
    const position = markerRef.current.getPosition();
    const latitude = position.lat();
    const longitude = position.lng();

    // 이동수단별 평균 속도(미터/시간)
    const speedTable = {
      car: 60000,
      bus: 40000,
      subway: 50000,
      walking: 5000,
    };
    // 이동수단별 감속 계수
    const reductionTable = {
      car: 0.7,
      bus: 0.6,
      subway: 0.5,
      walking: 0.4,
    };
    const transports = selectedTransports;
    const adjustedSpeeds = transports.map((t) => {
      return speedTable[t] || 0;
    });
    const totalSpeed = adjustedSpeeds.reduce((acc, s) => acc + s, 0);
    const avgSpeedMph = totalSpeed / transports.length;
    const avgSpeedMpm = avgSpeedMph / 60; // 분당 미터
    let outerRadius = avgSpeedMpm * time; // 미터

    // 선택된 이동수단 중 가장 작은 감속 계수 적용
    if (transports.length > 0) {
      const reductions = transports.map((t) => reductionTable[t] || 1);
      const minReduction = Math.min(...reductions);
      outerRadius = outerRadius * minReduction;
    }

    const innerRadius = outerRadius * 0.72;

    // 외부/내부 원 그리기 (투명)
    outerCircleRef.current = new window.Tmapv2.Circle({
      center: new window.Tmapv2.LatLng(latitude, longitude),
      radius: outerRadius,
      strokeWeight: 2,
      strokeColor: "#3399ff",
      strokeOpacity: 0.7,
      fillColor: "#3399ff",
      fillOpacity: 0,
      map: mapInstanceRef.current,
    });

    innerCircleRef.current = new window.Tmapv2.Circle({
      center: new window.Tmapv2.LatLng(latitude, longitude),
      radius: innerRadius,
      strokeWeight: 2,
      strokeColor: "#3399ff",
      strokeOpacity: 0.7,
      fillColor: "#3399ff",
      fillOpacity: 0,
      map: mapInstanceRef.current,
    });

    // 도넛형(링) 폴리곤 경로 계산
    const pointsCount = 60;
    const metersToLatLng = (lat, lng, dx, dy) => {
      const latConv = 111320;
      const lngConv = 111320 * Math.cos((lat * Math.PI) / 180);
      const newLat = lat + dy / latConv;
      const newLng = lng + dx / lngConv;
      return new window.Tmapv2.LatLng(newLat, newLng);
    };

    const outerPoints = [];
    const innerPoints = [];
    for (let i = 0; i <= pointsCount; i++) {
      const angle = (2 * Math.PI * i) / pointsCount;
      const ox = outerRadius * Math.cos(angle);
      const oy = outerRadius * Math.sin(angle);
      outerPoints.push(metersToLatLng(latitude, longitude, ox, oy));
    }
    for (let i = pointsCount; i >= 0; i--) {
      const angle = (2 * Math.PI * i) / pointsCount;
      const ix = innerRadius * Math.cos(angle);
      const iy = innerRadius * Math.sin(angle);
      innerPoints.push(metersToLatLng(latitude, longitude, ix, iy));
    }

    const ringPath = outerPoints.concat(innerPoints);

    ringPolygonRef.current = new window.Tmapv2.Polygon({
      paths: ringPath,
      strokeWeight: 2,
      strokeColor: "#3399ff",
      strokeOpacity: 0.7,
      fillColor: "#3399ff",
      fillOpacity: 0.2,
      map: mapInstanceRef.current,
    });

  }, [selectedTransports, time])

  // 렌더링 부분
  return (
    <div className="app-wrapper">
      <div className="app-container">
        <header className="app-header">
          <div className="header-inner">
            <h1 className="header-logo">GOSTOP</h1>
          </div>
        </header>

        <main className="app-main">
          {/* 현재 위치 입력/버튼 */}
          <section className="location-section">
            <h3 className="section-title">현재 위치</h3>
            <div className="location-input-wrapper">
              <input
                type="text"
                placeholder="위치를 입력하세요"
                className="location-input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <button className="location-btn" onClick={getCurrentLocation}>
                <i className="fas fa-location-crosshairs location-btn-icon"></i>
              </button>
            </div>
          </section>

          {/* 이동수단 선택 */}
          <section className="transport-section">
            <h3 className="section-title">이동 수단 선택</h3>
            <div className="transport-grid">
              {[
                { icon: 'car', label: '자동차' },
                { icon: 'bus', label: '버스' },
                { icon: 'subway', label: '지하철' },
                { icon: 'walking', label: '도보' },
              ].map((item) => (
                <button
                  key={item.icon}
                  className={`transport-btn ${selectedTransports.includes(item.icon)
                    ? 'transport-btn-selected'
                    : 'transport-btn-default'
                    }`}
                  onClick={() => toggleTransport(item.icon)}
                >
                  <i className={`fas fa-${item.icon} transport-btn-icon`}></i>
                  <span className="transport-btn-label">{item.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 시간 설정 */}
          <section className="time-section">
            <h3 className="section-title">여행 시간 설정</h3>
            <div className="time-range-container">
              <input
                type="range"
                min="20"
                max="720"
                value={time}
                onChange={(e) => setTime(parseInt(e.target.value))}
                className="time-range-slider"
                step="10"
              />
              <div className="time-range-labels">
                <span className="time-range-label">20분</span>
                <span className="time-range-label">
                  {Math.floor(time / 60)}시간 {time % 60}분
                </span>
                <span className="time-range-label">12시간</span>
              </div>
            </div>
          </section>

          {/* 지도 표시 */}
          <div className="map-container">
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          </div>

          {/* 랜덤 여행 버튼 */}
          <button
            className="start-btn"
            onClick={() => {
              if (
                !markerRef.current ||
                !mapInstanceRef.current ||
                !outerCircleRef.current ||
                !innerCircleRef.current
              ) {
                alert('지도를 초기화하거나 이동수단/시간을 선택해주세요.');
                return;
              }
              // 중심과 반지름 정보 가져오기
              const center = outerCircleRef.current.getCenter();
              const outerRadius = outerCircleRef.current.getRadius(); // 미터
              const innerRadius = innerCircleRef.current.getRadius();

              // 도넛 영역 내에 있는 위치만 필터링
              const latConv = 111320;
              const lngConv = 111320 * Math.cos((center.lat() * Math.PI) / 180);

              const filterInDonut = locations.filter(({ lat, lng }) => {
                const dLat = (lat - center.lat()) * latConv;
                const dLng = (lng - center.lng()) * lngConv;
                const dist = Math.sqrt(dLat * dLat + dLng * dLng);
                return dist >= innerRadius && dist <= outerRadius;
              });

              if (filterInDonut.length === 0) {
                alert('도넛 영역 내에 여행지가 없습니다.');
                return;
              }

              // 랜덤 위치 선택
              const randomIdx = Math.floor(Math.random() * filterInDonut.length);
              const { lat, lng, name } = filterInDonut[randomIdx];

              // 기존 랜덤 마커 제거
              if (window._randomTravelMarkerA) {
                window._randomTravelMarkerA.setMap(null);
              }
              if (window._randomTravelMarkerB) {
                window._randomTravelMarkerB.setMap(null);
              }
              // 출발지 마커
              window._randomTravelMarkerA = new window.Tmapv2.Marker({
                position: center,
                map: mapInstanceRef.current,
                label: 'A',
              });
              // 도착지 마커
              window._randomTravelMarkerB = new window.Tmapv2.Marker({
                position: new window.Tmapv2.LatLng(lat, lng),
                map: mapInstanceRef.current,
              });

              // 기존 InfoWindow 제거
              if (window._randomTravelInfoWindowB) {
                window._randomTravelInfoWindowB.setMap(null);
              }
              // 관광지명 InfoWindow 생성
              window._randomTravelInfoWindowB = new window.Tmapv2.InfoWindow({
                position: new window.Tmapv2.LatLng(lat, lng),
                content: `<div style="background:#fff;padding:4px 8px;border-radius:6px;border:1px solid #3399ff;font-size:14px;white-space:nowrap;">${name}</div>`,
                type: 2,
                map: mapInstanceRef.current,
                offset: new window.Tmapv2.Point(0, -30), // 마커 위에 표시
              });
              // 지도 중심 이동
              mapInstanceRef.current.setCenter(new window.Tmapv2.LatLng(lat, lng));
            }}
          >
            <i className="fas fa-random start-btn-icon"></i>
            랜덤 여행 시작하기
          </button>
        </main>
      </div>
    </div>
  )
}

export default App