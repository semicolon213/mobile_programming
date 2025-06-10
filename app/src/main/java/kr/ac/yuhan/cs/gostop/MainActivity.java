package kr.ac.yuhan.cs.gostop;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.EdgeToEdge;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private static final int REQUEST_LOCATION_PERMISSION = 1;
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });

        // WebView는 여기서 초기화만 (설정은 권한 확인 후에)
        webView = findViewById(R.id.webview);

        // 위치 권한 먼저 확인 및 요청
        checkAndRequestLocationPermission();
    }

    // 권한 처리 결과 런처
    ActivityResultLauncher<String[]> permissionsResultLauncher =
            registerForActivityResult(
                    new ActivityResultContracts.RequestMultiplePermissions(),
                    isGranted -> {
                        boolean hasDeniedPermissions = false;
                        for (Map.Entry<String, Boolean> entry : isGranted.entrySet()) {
                            if (!entry.getValue()) {
                                hasDeniedPermissions = true;
                                Log.e(MainActivity.class.getSimpleName(), "Permission denied: " + entry.getKey());
                            }
                        }
                        if (!hasDeniedPermissions) {
                            Log.d(MainActivity.class.getSimpleName(), "All permissions granted!");
                            initializeAndLoadWebView(); // 권한 승인 후 WebView 초기화
                        } else {
                            // 권한이 없으면 WebView를 로드하지 않음
                            Log.e("MainActivity", "위치 권한이 없어 WebView를 로드하지 않음");
                        }
                    }
            );

    // 권한 확인 및 요청 함수
    private void checkAndRequestLocationPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            // 권한 요청
            permissionsResultLauncher.launch(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            });
        } else {
            Log.d("MainActivity", "위치 권한 이미 허용됨");
            initializeAndLoadWebView(); // 이미 허용되었으면 바로 초기화
        }
    }

    // WebView 초기화 함수 (권한 허용 후에만 호출됨)
    private void initializeAndLoadWebView() {
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);             /// JS 활성화
        webSettings.setDomStorageEnabled(true);             /// PWA 사용 시 필요
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setSupportZoom(false);
        webSettings.setJavaScriptCanOpenWindowsAutomatically(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.setWebViewClient(new WebViewClient());

        webView.setWebChromeClient(new MyWebChrome(this, permissionList ->
                permissionsResultLauncher.launch(permissionList.toArray(new String[0]))) {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });

        // React PWA 사이트 주소 입력
        webView.loadUrl("https://yuhangostop.netlify.app/");
    }

    @Override
    public void onBackPressed() {                           /// 화면에서 뒤로가기 사용 시 PWA 사이트 뒤로가기
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}