package org.legend_list.flash_list_autolayout

import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AutoLayoutPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf()
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    Log.d("ALAutoLayoutPackage", "createViewManagers")
      return listOf(
        AutoLayoutViewManager(),
        CellContainerManager()
    )
  }
}
