plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.universe.projectbrowser.sync"
    compileSdk = libs.versions.compileSdk.get().toInt()

    defaultConfig {
        minSdk = libs.versions.minSdk.get().toInt()
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests.all { test ->
            test.systemProperty("universe.syncFixtures", rootProject.layout.projectDirectory.dir("../../packages/sync/tests/fixtures").asFile.absolutePath)
            listOf("universe.crossCheck.swiftWrote", "universe.crossCheck.kotlinWrites").forEach { key ->
                System.getProperty(key)?.let { test.systemProperty(key, it) }
            }
            test.outputs.upToDateWhen { System.getProperty("universe.crossCheck.swiftWrote") == null }
        }
    }
}

dependencies {
    api(project(":shared"))
    implementation(libs.serialization.json)
    api(libs.coroutines.android)
    implementation(libs.work.runtime)
    testImplementation(libs.junit)
    androidTestImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.junit)
}
