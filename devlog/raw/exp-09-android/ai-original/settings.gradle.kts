pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "EventReg"

// :api  — 純 JVM 模組,內容全由 OpenAPI Generator 從 openapi.yaml 產生
// :app  — Android App(Compose)
include(":api", ":app")
