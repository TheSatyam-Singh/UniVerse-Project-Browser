plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.universe.projectbrowser.android"
    compileSdk = libs.versions.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.universe.projectbrowser.android"
        minSdk = libs.versions.minSdk.get().toInt()
        targetSdk = libs.versions.targetSdk.get().toInt()
        versionCode = 1
        versionName = "0.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        testInstrumentationRunnerArguments["useTestStorageService"] = "true"
    }

    val releaseKeystoreFile = (System.getenv("UNIVERSE_RELEASE_STORE_FILE") ?: project.findProperty("universe.release.storeFile") as? String)
        ?.let { project.file(it) }?.takeIf { it.exists() }
    val releaseKeystorePassword = System.getenv("UNIVERSE_RELEASE_STORE_PASSWORD") ?: project.findProperty("universe.release.storePassword") as? String
    val releaseKeyAlias = System.getenv("UNIVERSE_RELEASE_KEY_ALIAS") ?: project.findProperty("universe.release.keyAlias") as? String
    val releaseKeyPassword = System.getenv("UNIVERSE_RELEASE_KEY_PASSWORD") ?: project.findProperty("universe.release.keyPassword") as? String
    val hasReleaseSigning = releaseKeystoreFile != null && releaseKeystorePassword != null && releaseKeyAlias != null && releaseKeyPassword != null

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = releaseKeystoreFile
                storePassword = releaseKeystorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }
}

dependencies {
    implementation(project(":appmodel"))
    implementation(project(":search"))
    implementation(project(":browsing"))
    implementation(project(":tabs"))
    implementation(project(":settings"))
    implementation(platform(libs.compose.bom))
    implementation(libs.activity.compose)
    implementation(libs.coroutines.android)
    implementation(libs.splashscreen)
    implementation(libs.glance.appwidget)
    implementation(libs.work.runtime)
    testImplementation(libs.junit)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.coroutines.test)
    testImplementation(platform(libs.compose.bom))
    testImplementation(libs.compose.ui.test.junit4)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.androidx.test.junit)
    androidTestImplementation(libs.androidx.test.services.storage)
    androidTestImplementation(libs.coroutines.test)
    androidTestUtil(libs.androidx.test.services)
    debugImplementation(libs.compose.ui.test.manifest)
}
