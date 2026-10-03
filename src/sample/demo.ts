export const DEMO_SOURCE = `App:
  Properties:
    StartScreen: =Home
    OnStart: |-
      =Set(varReady, true)

Screens:
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
`;
