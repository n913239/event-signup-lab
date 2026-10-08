import org.openapitools.generator.gradle.plugin.tasks.GenerateTask

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.openapi.generator)
}

// 可用 -PapiBaseUrl=https://... 覆寫;預設給模擬器連本機。
val apiBaseUrl: String = (findProperty("apiBaseUrl") as String?) ?: "http://10.0.2.2:8788"

val openApiOutputDir = layout.buildDirectory.dir("generated/openapi")

val generateApiClient = tasks.register<GenerateTask>("generateApiClient") {
    generatorName.set("kotlin")
    inputSpec.set(rootProject.file("openapi.yaml").absolutePath)
    outputDir.set(openApiOutputDir.get().asFile.absolutePath)
    packageName.set("tw.example.eventsignup.api")
    apiPackage.set("tw.example.eventsignup.api.apis")
    modelPackage.set("tw.example.eventsignup.api.models")
    library.set("jvm-okhttp4")
    ignoreFileOverride.set(file("openapi-generator-ignore").absolutePath)
    cleanupOutput.set(true)
    configOptions.set(
        mapOf(
            "serializationLibrary" to "moshi",
            "dateLibrary" to "java8",
            "enumPropertyNaming" to "UPPERCASE",
            "sourceFolder" to "src/main/kotlin",
            "omitGradleWrapper" to "true",
        ),
    )
    globalProperties.set(
        mapOf(
            "apis" to "",
            "models" to "",
            "supportingFiles" to "",
            "apiDocs" to "false",
            "modelDocs" to "false",
            "apiTests" to "false",
            "modelTests" to "false",
        ),
    )
}

android {
    namespace = "tw.example.eventsignup"
    compileSdk = 35

    defaultConfig {
        applicationId = "tw.example.eventsignup"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
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

    sourceSets["main"].java.srcDir(openApiOutputDir.map { it.dir("src/main/kotlin") })

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

tasks.named("preBuild") { dependsOn(generateApiClient) }

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.kotlinx.coroutines.android)

    // 產生的 API client 需要的執行期依賴
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.moshi)
    implementation(libs.moshi.kotlin)
    implementation(libs.moshi.adapters)

    debugImplementation(libs.compose.ui.tooling)
    debugImplementation(libs.compose.ui.test.manifest)

    testImplementation(libs.junit)
    testImplementation(libs.okhttp.mockwebserver)

    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.core)
    androidTestImplementation(libs.androidx.test.junit)
}
