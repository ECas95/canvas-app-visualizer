import type { SourceFile } from "../types/canvas";

export const DEMO_FILES: SourceFile[] = [
  {
    path: "Src/App.pa.yaml",
    name: "App.pa.yaml",
    origin: "yaml",
    format: "pa-yaml-v3",
    content: `App:
  Properties:
    StartScreen: =Home
    OnStart: |-
      =Set(varReady, true)
`
  },
  {
    path: "Src/Home.pa.yaml",
    name: "Home.pa.yaml",
    origin: "yaml",
    format: "pa-yaml-v3",
    content: `Screens:
  Home:
    Properties:
      Fill: =RGBA(248, 249, 252, 1)
    Children:
      - Title:
          Control: Label
          Properties:
            Text: ="Inventory"
            X: =48
            Y: =32
            Width: =360
            Height: =52
      - SearchInput:
          Control: TextInput
          Properties:
            X: =48
            Y: =104
            Width: =320
            Height: =44
      - InventoryGallery:
          Control: Gallery
          Variant: Vertical
          Properties:
            X: =48
            Y: =176
            Width: =700
            Height: =430
            Items: =Filter(Inventory, StartsWith(Name, SearchInput.Text))
          Children:
            - RowTitle:
                Control: Label
                Properties:
                  Text: =ThisItem.Name
                  X: =24
                  Y: =12
                  Width: =280
                  Height: =36
      - RefreshButton:
          Control: Button
          Properties:
            Text: ="Refresh"
            X: =780
            Y: =176
            Width: =160
            Height: =44
            OnSelect: =ClearCollect(colInventory, Inventory)
      - StatusIcon:
          Control: Classic/Icon
          Variant: Check
          Properties:
            X: =780
            Y: =248
            Width: =40
            Height: =40
`
  }
];
