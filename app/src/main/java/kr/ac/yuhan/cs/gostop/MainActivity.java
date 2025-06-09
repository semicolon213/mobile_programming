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

        webView = findViewById(R.id.webview);

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

        webView.setWebChromeClient(new MyWebChrome(this, permissionList -> {
            permissionsResultLauncher.launch(permissionList.toArray(new String[0]));
        }){
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                super.onGeolocationPermissionsShowPrompt(origin, callback);
                callback.invoke(origin, true, false);
            }
        });

        // React PWA 사이트 주소 입력
        webView.loadUrl("https://yuhangostop.netlify.app/");
    }


    ActivityResultLauncher<String[]> permissionsResultLauncher =
            registerForPermissionResult(this);
    protected static ActivityResultLauncher<String[]> registerForPermissionResult(AppCompatActivity context) {
        if (context == null)
            throw new NullPointerException("Context cannot be null");

        return context.registerForActivityResult(
                new ActivityResultContracts.RequestMultiplePermissions(), isGranted -> {
                    boolean hasDeniedPermissions = false;
                    for (Map.Entry<String, Boolean> entry : isGranted.entrySet()) {
                        // checks if any of the permissions are denied.
                        if (!entry.getValue()) {
                            hasDeniedPermissions = true;
                            Log.e(MainActivity.class.getSimpleName(), "Permission denied: " + entry.getKey());
                        }
                    }
                    if (!hasDeniedPermissions) {
                        Log.d(MainActivity.class.getSimpleName(), "All permissions granted!");
                    }
                });
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