plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.openapi.generator)
}

val apiBaseUrl: String = (findProperty("apiBaseUrl") as String?) ?: "http://10.0.2.2:8788"
val generatedApiDir = layout.buildDirectory.dir("generated/openapi").get().asFile

// ── API client:從根目錄的 openapi.yaml 產生(跟 iOS 用同一份契約)──────────────
// kotlin + jvm-retrofit2 + gson + suspend。enum 一律 UPPERCASE(EventStatus.ON_SALE),
// 順便避開 Quote.applied 的 enum 裡有 null 值時產生 `null` 當識別字。
openApiGenerate {
    generatorName.set("kotlin")
    library.set("jvm-retrofit2")
    inputSpec.set(rootProject.file("openapi.yaml").absolutePath)
    outputDir.set(generatedApiDir.absolutePath)
    packageName.set("com.example.eventsignup.api")
    apiPackage.set("com.example.eventsignup.api.apis")
    modelPackage.set("com.example.eventsignup.api.models")
    configOptions.set(
        mapOf(
            "serializationLibrary" to "gson",
            "useCoroutines" to "true",
            "enumPropertyNaming" to "UPPERCASE",
            "dateLibrary" to "java8",
            "sourceFolder" to "src/main/kotlin",
            "omitGradleWrapper" to "true",
        )
    )
    generateApiTests.set(false)
    generateModelTests.set(false)
    generateApiDocumentation.set(false)
    generateModelDocumentation.set(false)
}

android {
    namespace = "com.example.eventsignup"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.example.eventsignup"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    sourceSets["main"].java.srcDir(File(generatedApiDir, "src/main/kotlin"))
}

tasks.named("preBuild") {
    dependsOn(tasks.named("openApiGenerate"))
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    debugImplementation(libs.compose.ui.tooling)

    // 產生的 client 用到的(jvm-retrofit2 + gson)
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.gson)
    implementation(libs.retrofit.converter.scalars)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.gson)
    implementation(libs.kotlinx.coroutines.android)

    implementation(libs.zxing.core)

    testImplementation(libs.junit)

    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.ext.junit)
    debugImplementation(libs.compose.ui.test.manifest)
}
